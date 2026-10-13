// Checks the Clerk script pins in src/lib/clerk-scripts.mjs against Clerk's CDN.
//
//   bun run check:clerk-pins      (or: node scripts/check-clerk-pins.mjs)
//
// Pinned, production no longer picks up a clerk-js or Clerk UI release on its
// own: the floating major URLs (clerk-js@6, ui@1) move to each new release, the
// pins stay put. This asks the CDN where the pinned majors point today and
// fails when that is not the pin, so a release Clerk has shipped since is a red
// run (the weekly Clerk Pin Drift workflow) rather than something nobody
// notices. It also fails if a pinned release stops being served. Run it before
// merging a pin change, and bump the pins to what it prints when it fails.
import { CLERK_JS_VERSION, CLERK_UI_VERSION } from "../src/lib/clerk-scripts.mjs";

// The Frontend API host production loads the scripts from.
const HOST = "https://clerk.courtvision.dev";

const PINS = [
  { name: "CLERK_JS_VERSION", pkg: "clerk-js", file: "clerk.browser.js", pin: CLERK_JS_VERSION },
  { name: "CLERK_UI_VERSION", pkg: "ui", file: "ui.browser.js", pin: CLERK_UI_VERSION },
];

const url = (pkg, version, file) => `${HOST}/npm/@clerk/${pkg}@${version}/dist/${file}`;

// Node's fetch sets no deadline of its own: a CDN that accepts the connection
// and then never answers holds a request until undici's headers timeout gives
// up, five minutes later. These HEADs come back in well under a second, so 15s
// only ever cuts off a stall.
const TIMEOUT_MS = 15_000;

// A HEAD that turns a timeout or network error into a failed check (one
// ::error:: line naming the URL) rather than an unhandled rejection's stack
// trace. Null when nothing answered.
async function head(target, init = {}) {
  try {
    return await fetch(target, { ...init, method: "HEAD", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    const reason =
      err.name === "TimeoutError"
        ? `no answer within ${TIMEOUT_MS / 1000}s`
        : `${err.message}${err.cause ? ` (${err.cause.code ?? err.cause.message})` : ""}`;
    console.error(`::error::HEAD ${target} failed: ${reason}`);
    return null;
  }
}

let stale = false;
for (const { name, pkg, file, pin } of PINS) {
  const floating = url(pkg, pin.split(".")[0], file);
  const res = await head(floating, { redirect: "manual" });
  if (!res) {
    stale = true;
    continue;
  }
  const location = res.headers.get("location") ?? "";
  const current = location.match(new RegExp(`/@clerk/${pkg}@(\\d+\\.\\d+\\.\\d+)/`))?.[1];
  if (!current) {
    console.error(`::error::${floating} answered ${res.status} with no versioned redirect`);
    stale = true;
    continue;
  }

  const exact = await head(url(pkg, pin, file));
  if (!exact) {
    stale = true;
  } else if (!exact.ok) {
    console.error(`::error::${name} ${pin} is not served: ${exact.status}`);
    stale = true;
  }

  if (current === pin) {
    console.log(`${name} ${pin}: current (@${pin.split(".")[0]} resolves to ${current})`);
  } else {
    console.error(
      `::error::${name} is ${pin} but @${pin.split(".")[0]} now resolves to ${current}; ` +
        `set it to "${current}" in src/lib/clerk-scripts.mjs`
    );
    stale = true;
  }
}

process.exit(stale ? 1 : 0);
