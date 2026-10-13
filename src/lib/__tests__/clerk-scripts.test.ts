import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { CLERK_JS_VERSION, CLERK_UI_VERSION } from "../clerk-scripts.mjs";

/**
 * Guards the Clerk script pins in src/lib/clerk-scripts.mjs against an SDK
 * upgrade. A pin the installed @clerk/nextjs doesn't expect would load a
 * clerk-js (or Clerk UI) the SDK was never built for, and nothing would fail
 * until sign-in broke in production. On any failure here: run
 * `bun run check:clerk-pins` and pin the versions it prints. This only sets a
 * floor (the releases the SDK was built against); falling behind Clerk's newer
 * releases is the weekly Clerk Pin Drift workflow's job, since it needs the
 * network.
 */

type ScriptOpts = {
  publishableKey: string;
  __internal_clerkJSVersion?: string;
  __internal_clerkUIVersion?: string;
};
type ScriptUrls = {
  clerkJSScriptUrl: (opts: ScriptOpts) => string;
  clerkUIScriptUrl: (opts: ScriptOpts) => string;
};
type VersionSelector = { versionSelector: (version?: string) => string };

// Resolve @clerk/shared the way the SDK does: @clerk/nextjs writes the
// <script> tags into the HTML, @clerk/react loads the same URLs in the browser.
const nextEntry = createRequire(import.meta.url).resolve("@clerk/nextjs");
const fromNext = createRequire(nextEntry);
const fromReact = createRequire(fromNext.resolve("@clerk/react"));
const sdks: [string, NodeJS.Require][] = [
  ["@clerk/nextjs", fromNext],
  ["@clerk/react", fromReact],
];

// A well-formed key for a made-up frontend API host.
const publishableKey = `pk_test_${btoa("clerk.example.test$")}`;

function versionIn(url: string, pkg: "clerk-js" | "ui"): string {
  return url.match(new RegExp(`/npm/@clerk/${pkg}@([^/]+)/`))?.[1] ?? `none in ${url}`;
}

const major = (version: string) => version.split(".")[0];

/** a >= b for x.y.z versions. */
function atLeast(a: string, b: string): boolean {
  const [x, y] = [a.split(".").map(Number), b.split(".").map(Number)];
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] > y[i];
  }
  return true;
}

/**
 * The release a version default in @clerk/shared's source names: the clerk-js
 * or Clerk UI that SDK build shipped with (only its major reaches the URL).
 */
function defaultVersionIn(fn: (...args: never[]) => unknown): string {
  return fn.toString().match(/"(\d+\.\d+\.\d+)"/)?.[1] ?? "unreadable";
}

describe("Clerk script pins", () => {
  test("are exact x.y.z versions, never a floating tag", () => {
    expect(CLERK_JS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(CLERK_UI_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  for (const [sdk, load] of sdks) {
    const { clerkJSScriptUrl, clerkUIScriptUrl } = load(
      "@clerk/shared/loadClerkJsScript"
    ) as ScriptUrls;
    const { versionSelector } = load("@clerk/shared/versionSelector") as VersionSelector;

    test(`are the majors ${sdk} asks for unpinned`, () => {
      expect(`clerk-js@${major(CLERK_JS_VERSION)}`).toBe(
        `clerk-js@${versionIn(clerkJSScriptUrl({ publishableKey }), "clerk-js")}`
      );
      expect(`ui@${major(CLERK_UI_VERSION)}`).toBe(
        `ui@${versionIn(clerkUIScriptUrl({ publishableKey }), "ui")}`
      );
    });

    test(`are no older than the releases ${sdk}'s @clerk/shared shipped with`, () => {
      // clerk-js falls back to versionSelector's default, Clerk UI to the one
      // clerkUIScriptUrl passes it.
      const jsShipped = defaultVersionIn(versionSelector);
      const uiShipped = defaultVersionIn(clerkUIScriptUrl);
      expect(jsShipped).toMatch(/^\d+\.\d+\.\d+$/);
      expect(uiShipped).toMatch(/^\d+\.\d+\.\d+$/);
      const verdict = (pin: string, shipped: string) =>
        atLeast(pin, shipped) ? "ok" : `pin ${pin} is older than ${shipped}`;
      expect(`clerk-js ${verdict(CLERK_JS_VERSION, jsShipped)}`).toBe("clerk-js ok");
      expect(`ui ${verdict(CLERK_UI_VERSION, uiShipped)}`).toBe("ui ok");
    });

    test(`reach ${sdk}'s script URLs as exact versions`, () => {
      const opts = {
        publishableKey,
        __internal_clerkJSVersion: CLERK_JS_VERSION,
        __internal_clerkUIVersion: CLERK_UI_VERSION,
      };
      expect(clerkJSScriptUrl(opts)).toBe(
        `https://clerk.example.test/npm/@clerk/clerk-js@${CLERK_JS_VERSION}/dist/clerk.browser.js`
      );
      expect(clerkUIScriptUrl(opts)).toBe(
        `https://clerk.example.test/npm/@clerk/ui@${CLERK_UI_VERSION}/dist/ui.browser.js`
      );
    });
  }

  test("are still read by @clerk/nextjs from the env vars next.config.mjs sets", () => {
    // If a release stopped reading them, the pins would silently stop
    // applying and the pages would go back to the 307ing major-only URLs.
    const dist = join(dirname(nextEntry), "..", "esm");
    const sources = readdirSync(dist, { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".js"))
      .map((file) => readFileSync(join(dist, file), "utf8"));
    for (const name of ["NEXT_PUBLIC_CLERK_JS_VERSION", "NEXT_PUBLIC_CLERK_UI_VERSION"]) {
      expect(sources.some((src) => src.includes(`process.env.${name}`)) ? name : "unread").toBe(
        name
      );
    }
  });
});
