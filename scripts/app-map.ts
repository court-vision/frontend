// The app map's crawl (docs/APP_MAP_PLAN.md § 2): walks a production build of
// this commit in a headless browser and writes what a user can reach, see and
// do on every desk, for CV AI to read. Nothing in it is written by hand: the
// seeds are the desks in routes.ts, the screens are what clicking finds, and
// the words come from the accessibility tree and the source.
//
//   bun run build && bun run start -p 3000
//   bun scripts/app-map.ts --base http://localhost:3000 --out app-map.json [--summary summary.md]
//   bun scripts/app-map.ts --base https://www.courtvision.dev --serve http://localhost:3000 ...
//
// Options: --desks week,scout (a subset), --depth 3, --screens 40 (per seed),
// --minutes 5 (per seed), --workers 3 (pages per seed), --build <sha>
// (default $GITHUB_SHA or git HEAD).
// CHROMIUM_PATH picks the browser binary (default: Playwright's own).
//
// --serve stands the build in for --base (the stand-in, below): a build with
// production's Clerk key works only at production's address.
//
// Signed out, through the desks' demos (`?demo`) and the public desks. With
// APP_MAP_TOKEN (and --serve), signed in first as the app map's own account,
// through the desks as a user has them; the demos then add only what it
// didn't show. Every request that isn't GET, HEAD or OPTIONS is aborted, bar
// the few that keep Clerk's session alive (src/lib/app-map/clerk.ts), so no
// click can write anything anywhere; demo writes stay in the tab, and storage
// is cleared on every load.
import { execSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { chromium, type Browser, type BrowserContext, type Cookie, type Page, type Request } from "playwright";
import { ALL_DESKS } from "@/components/desk/routes";
import {
  controlsOf, fingerprint, fresh, INPUTS, parseSnapshot, parts, prune, render, searchable, structure, within,
  type AriaNode, type Control,
} from "@/lib/app-map/aria";
import { clerkFrontendApi, keepsSessionAlive } from "@/lib/app-map/clerk";
import { APP_MAP_VERSION, deskOfFile, screenId, type AppMap, type MapCopy, type MapDesk, type MapScreen, type MapStep } from "@/lib/app-map/map";
import { chromeTest, copyOf, pageParams, seenIn, sweptFile } from "@/lib/app-map/sweep";

// ---- options ----

const argv = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const BASE = opt("base", "http://localhost:3000").replace(/\/$/, "");
const SERVE = opt("serve", "").replace(/\/$/, "");
const API = (process.env.NEXT_PUBLIC_API_BASE || "https://api.courtvision.dev").replace(/\/$/, "");
const OUT = opt("out", "app-map.json");
const SUMMARY = opt("summary", "");
const ONLY = opt("desks", "").split(",").filter(Boolean);
const MAX_DEPTH = Number(opt("depth", "3"));
const MAX_SCREENS = Number(opt("screens", "40"));
const SEED_MS = Number(opt("minutes", "5")) * 60_000;
const WORKERS = Number(opt("workers", "3"));
const SEEDS_AT_ONCE = 2;
const BUILD = opt("build", process.env.GITHUB_SHA || git("rev-parse HEAD"));
const ROOT = process.cwd();

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

// ---- the source sweep ----

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(relative(ROOT, p));
  }
  return out;
}

const files = walk(join(ROOT, "src")).filter(sweptFile);
const copyByFile = files.map((file) => ({ file, strings: copyOf(file, readFileSync(file, "utf8")) })).filter((c) => c.strings.length > 0);
const isChrome = chromeTest(copyByFile.flatMap((c) => c.strings));
/** The app's own words about the demo ("Reset demo", the demo badge): left out of the map, never clicked. */
const isDemoChrome = (s: string | undefined) => !!s && /\bdemo\b/i.test(s) && isChrome(s);

// ---- the stand-in ----

/**
 * With --serve, the browser opens --base (production's address) and gets this
 * build: Chromium maps the site's host to a TLS proxy here, in front of the
 * build's server, so Clerk's production instance, the API and its CORS take
 * the page for production while nothing reaches production's frontend. The
 * proxy only reads (anything but GET, HEAD and OPTIONS is a 405), its
 * certificate is made for the run and is the only one trusted beyond the
 * usual (by its key's hash), and it marks every response with a value made
 * for the run: a response from the site without it came from elsewhere, and
 * the crawl stops (`breach`).
 */
interface StandIn {
  host: string;
  mark: string;
  args: string[];
  stop(): void;
}

const STAND_IN_MARK = "x-app-map-stand-in";
let standIn: StandIn | null = null;

function startStandIn(): StandIn {
  const dir = mkdtempSync(join(tmpdir(), "app-map-"));
  execSync("openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=app-map-stand-in -keyout key.pem -out cert.pem", { cwd: dir, stdio: "ignore" });
  const spki = execSync("openssl x509 -pubkey -noout -in cert.pem | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64", { cwd: dir, encoding: "utf8" }).trim();
  const host = new URL(BASE).host;
  const mark = crypto.randomUUID();
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    tls: { cert: readFileSync(join(dir, "cert.pem"), "utf8"), key: readFileSync(join(dir, "key.pem"), "utf8") },
    async fetch(req) {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) return new Response(null, { status: 405, headers: { [STAND_IN_MARK]: mark } });
      const u = new URL(req.url);
      const headers = new Headers(req.headers);
      headers.set("x-forwarded-host", host);
      headers.set("x-forwarded-proto", "https");
      const res = await fetch(SERVE + u.pathname + u.search, { method: req.method, headers, redirect: "manual" });
      // fetch hands the body back decoded: its encoding and length no longer describe it
      const out = new Headers(res.headers);
      out.delete("content-encoding");
      out.delete("content-length");
      out.set(STAND_IN_MARK, mark);
      return new Response(res.body, { status: res.status, headers: out });
    },
  });
  const args = [`--host-resolver-rules=MAP ${host} 127.0.0.1:${server.port}`, `--ignore-certificate-errors-spki-list=${spki}`];
  // Through a proxy the browser never resolves the site itself and the map can't apply: name the proxy, so the site can bypass it
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxy) args.push(`--proxy-server=${proxy}`, `--proxy-bypass-list=${host}`);
  return { host, mark, args, stop: () => void server.stop(true) };
}

/** A response from the site that the stand-in didn't send: stop before anything else goes there. */
function breach(url: string): never {
  console.error(`::error::${url} answered without the stand-in's mark: the crawl reached the real site, so it stops here`);
  process.exit(2);
}

// ---- the browser ----

/**
 * Clerk's Frontend API, from the build's publishable key: the one host a click
 * may write to, and only to keep a session alive (`keepsSessionAlive`).
 */
const CLERK_FAPI = clerkFrontendApi(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "");
/** A development instance's visitor cookies, made once and shared by every context, so Clerk's middleware sees a visitor it knows. */
let clerkCookies: Cookie[] = [];

/** The parts of Clerk the crawl calls itself; the page's own window.Clerk. */
type ClerkWindow = {
  Clerk?: {
    loaded?: boolean;
    client?: { signIn: { create(p: { strategy: "ticket"; ticket: string }): Promise<{ status: string | null; createdSessionId: string | null }> } };
    session?: { getToken(o: { skipCache: boolean }): Promise<string | null> } | null;
    setActive(p: { session: string | null }): Promise<void>;
    signOut(): Promise<void>;
  };
};

const blocked: string[] = [];
const findings: AppMap["findings"] = [];
const finding = (kind: string, desk: string, detail: string) => {
  if (!findings.some((f) => f.kind === kind && f.desk === desk && f.detail === detail)) findings.push({ kind, desk, detail });
};

/**
 * A browser context the crawl's rules hold: storage cleared on every load,
 * and no writes. `clerkWrites` lets its pages write to Clerk, for the context
 * that signs in; a signed-in context gets the run's session before each load
 * (`session`).
 */
async function newContext(browser: Browser, opts: { clerkWrites?: boolean } = {}): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (standIn) {
    const { host, mark } = standIn;
    ctx.on("response", (r) => {
      if (new URL(r.url()).host === host && r.headers()[STAND_IN_MARK] !== mark) breach(r.url());
    });
  }
  if (clerkCookies.length) await ctx.addCookies(clerkCookies);
  // Every load starts clean: demo rooms and theme live in storage, and a room
  // deleted on one branch of the crawl must not stay deleted on the next.
  await ctx.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
  await ctx.route("**/*", (route) => {
    const req = route.request();
    // Pictures and fonts change no role or name (an image's alt is in the page): not fetched
    if (["image", "font", "media"].includes(req.resourceType())) return route.abort("blockedbyclient");
    if (["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.continue();
    if (CLERK_FAPI && new URL(req.url()).host === CLERK_FAPI && (opts.clerkWrites || keepsSessionAlive(req.url(), req.method()))) return route.continue();
    blocked.push(`${req.method()} ${req.url()}`);
    return route.abort("blockedbyclient");
  });
  return ctx;
}

/**
 * A page that counts its requests in flight, so a click can wait for what it
 * fetched: data, pages and the app's own code. Other sites' scripts (Clerk,
 * analytics) retry on their own schedule and aren't waited for.
 */
async function newPage(ctx: BrowserContext): Promise<{ page: Page; settle: () => Promise<void> }> {
  const page = await ctx.newPage();
  const origin = new URL(BASE).origin;
  const counted = new Set<Request>();
  const waits = (r: Request) =>
    ["document", "fetch", "xhr"].includes(r.resourceType()) || (r.resourceType() === "script" && r.url().startsWith(origin));
  page.on("request", (r) => {
    if (waits(r)) counted.add(r);
  });
  page.on("requestfinished", (r) => counted.delete(r));
  page.on("requestfailed", (r) => counted.delete(r));
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  page.on("popup", (p) => p.close().catch(() => {}));
  const settle = async () => {
    await page.waitForTimeout(200);
    const until = Date.now() + 3000;
    let quiet = 0;
    while (Date.now() < until && quiet < 3) {
      quiet = counted.size === 0 ? quiet + 1 : 0;
      await page.waitForTimeout(100);
    }
  };
  return { page, settle };
}

const locate = (page: Page, c: Control) =>
  page.getByRole(c.role as Parameters<Page["getByRole"]>[0], { name: c.name, exact: true }).nth(c.nth);

async function snapshot(page: Page): Promise<AriaNode[]> {
  return stripDemo(parseSnapshot(await page.locator("body").ariaSnapshot({ timeout: 15_000 })));
}

/** `?demo` out of a URL or an href, keeping the rest of its query. A link off the app keeps its whole URL. */
function undemo(url: string): string {
  const u = new URL(url, BASE);
  if (u.origin !== new URL(BASE).origin) return u.href;
  u.searchParams.delete("demo");
  const q = u.searchParams.toString();
  return `${u.pathname}${q ? `?${q}` : ""}`;
}

/** The demo's own furniture out of a tree: its badge, its reset button, "(demo)" in toasts. */
function stripDemo(nodes: AriaNode[]): AriaNode[] {
  return nodes
    .filter((n) => !isDemoChrome(n.name) && !isDemoChrome(n.value))
    .map((n) => ({
      ...n,
      name: n.name?.replace(/\s*\(demo\)/gi, ""),
      value: n.value?.replace(/\s*\(demo\)/gi, ""),
      props: n.props.url ? { ...n.props, url: undemo(n.props.url) } : n.props,
      children: stripDemo(n.children),
    }));
}

/** Controls a reader can't name, and things that click but have no role, on the page now. */
async function audit(page: Page, desk: string) {
  const out = await page.evaluate(() => {
    const interactive = "a[href], button, input, select, textarea, summary, [role], [tabindex]";
    const visible = (e: Element) => (e as HTMLElement).getClientRects().length > 0;
    const unnamed = [...document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea")]
      .filter(visible)
      .filter((e) => {
        const label = (e as HTMLInputElement).labels?.length;
        return !(e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || e.getAttribute("title") || (e as HTMLElement).innerText?.trim() || e.getAttribute("placeholder") || label);
      })
      .slice(0, 5)
      .map((e) => e.outerHTML.slice(0, 120));
    const roleless = [...document.querySelectorAll("tr, td, div, span, li")]
      .filter(visible)
      .filter((e) => getComputedStyle(e).cursor === "pointer" && !e.closest(interactive) && !e.querySelector(interactive))
      .slice(0, 3)
      .map((e) => `${e.tagName.toLowerCase()}: ${(e as HTMLElement).innerText.trim().replace(/\s+/g, " ").slice(0, 60)}`);
    return { unnamed, roleless };
  });
  for (const u of out.unnamed) finding("control without a name", desk, u);
  for (const r of out.roleless) finding("clickable without a role", desk, r);
}

// ---- exploring ----

interface Seed {
  desk: string;
  url: string;
  /** Only the front: a link to try against screens already found. */
  frontOnly?: boolean;
  /** As the app map's account; otherwise signed out. */
  signedIn?: boolean;
}

const screens: MapScreen[] = [];
const byFingerprint = new Map<string, MapScreen>();
const desks = new Map<string, MapDesk>();
const work = { clicks: 0, loads: 0 };
/** Every state of every part of a page recorded so far, by desk and route. */
const seenParts = new Set<string>();
/** Each screen's parts, to match a link's page to the screen clicks reached. */
const partsOf = new Map<MapScreen, string>();

/** A control to act on; `fill` is the name typed into a search. */
type Act = Control & { fill?: string };

const step = (c: Act): MapStep => ({
  role: c.role,
  name: c.name,
  ...(c.example ? { example: true as const } : {}),
  ...(c.within ? { within: c.within } : {}),
  ...(c.fill !== undefined ? { typed: c.fill } : {}),
});

const stepTitle = (c: Act) => (c.fill !== undefined ? `${c.name} “${c.fill}”` : c.name);

/**
 * One step, as a user takes it: types the name into a search, slides a slider
 * to its end (End, as from the keyboard: the Week tray's slide to send), or clicks.
 */
async function act(page: Page, c: Act, timeout: number) {
  const el = locate(page, c);
  if (c.fill !== undefined) await el.fill(c.fill, { timeout });
  else if (c.role === "slider") {
    await el.focus({ timeout });
    await page.keyboard.press("End");
  } else await el.click({ timeout });
}

/** A name to search for, from the page itself: the longest word of the first control named by data ("Jokić"). */
function probeOf(controls: Control[]): string | null {
  const name = controls.find((c) => c.example && /\p{L}{4}/u.test(c.name))?.name;
  return name ? name.split(/\s+/).filter((w) => /^\p{L}+$/u.test(w)).sort((a, b) => b.length - a.length)[0] ?? null : null;
}

/** A page's parts (`parts`), keyed by desk and route. */
function partsKeys(desk: string, url: string, tree: AriaNode[]): string[] {
  const route = `${desk}|${routeOf(new URL(url).pathname)}`;
  return parts(tree, isChrome).map((p) => `${route}|${p}`);
}

function fingerprintOf(url: string, tree: AriaNode[]): string {
  const u = new URL(url);
  return fingerprint(structure(u.pathname, [...u.searchParams.keys()], tree, isChrome));
}

/** Two URLs of one screen that differ only in some params' values: those params pick the subject. */
function varying(a: string, b: string): string[] {
  const ua = new URL(a, BASE);
  const ub = new URL(b, BASE);
  if (ua.pathname !== ub.pathname) return [];
  const ka = [...ua.searchParams.keys()].sort().join("&");
  const kb = [...ub.searchParams.keys()].sort().join("&");
  if (ka !== kb) return [];
  return [...ua.searchParams.keys()].filter((k) => ua.searchParams.get(k) !== ub.searchParams.get(k));
}

/**
 * One thing to do from a screen: a click, or the palette's key. A worker whose
 * page already shows `fp` does it there; any other replays `trail` first.
 */
interface Job {
  trail: Act[];
  fp: string;
  tree: AriaNode[];
  action: Act | "front" | "palette";
}

/**
 * Explores one seed breadth first, with `WORKERS` pages taking jobs from one
 * queue: each click that opens a screen not seen before records it (what the
 * click added, under where it sits) and queues the clicks that screen added.
 * After each click a worker goes back with Escape, or reloads when it must.
 */
async function explore(browser: Browser, seed: Seed) {
  const started = Date.now();
  const jobs: Job[] = [{ trail: [], fp: "", tree: [], action: "front" }];
  const queued = new Set<string>();
  let found = 0;
  let busy = 0;
  let stop: string | null = null;
  let probe: string | null = null;

  const enqueue = (trail: Act[], fp: string, tree: AriaNode[], added: Set<AriaNode> | null) => {
    if (seed.frontOnly || trail.length >= MAX_DEPTH) return;
    const controls = controlsOf(tree, isChrome, added ?? undefined);
    probe ??= probeOf(controls);
    const last = trail.at(-1);
    for (const c of controls) {
      if (c.role === "link" || c.disabled || isDemoChrome(c.name)) continue;
      // Signing out would end the run's one session, for every page at once
      if (seed.signedIn && /\b(?:sign|log) ?out\b/i.test(c.name)) continue;
      // The control that opened this screen changed with it ([expanded]); clicking it again only closes it
      if (last && c.role === last.role && c.name === last.name) continue;
      // A search gets a name typed in (a combobox is also clicked open); other text inputs are only recorded
      if (searchable(c) && probe) jobs.push({ trail, fp, tree, action: { ...c, fill: probe } });
      if (c.role !== "combobox" && c.role !== "slider" && (INPUTS.has(c.role) || searchable(c))) continue;
      jobs.push({ trail, fp, tree, action: c });
    }
  };

  /** A screen not seen before; false when it is the same thing as one recorded already. */
  // A seed off the desk's own path (a draft room, a recap) names its screens by its route: "draft/room/recap"
  const href = desks.get(seed.desk)?.href ?? "";
  const seedPath = new URL(seed.url, BASE).pathname;
  const rest = seedPath === href ? "" : routeOf(seedPath).slice(href.length).replace(/\[id\]/g, "room");
  const base = rest ? screenId(seed.desk, [{ role: "link", name: rest.replace(/\//g, " ") }]) : seed.desk;
  const label = `${desks.get(seed.desk)?.label ?? seed.desk}${rest ? ` ${rest.replace(/\//g, " ").trim()}` : ""}`;

  /** Screens opened from one screen by clicks that pick a subject through the URL, by the URL's shape. */
  const fanned = new Map<string, MapScreen[]>();

  const record = (trail: Act[], url: string, tree: AriaNode[], fp: string, parent: { tree: AriaNode[]; url: string; fp: string } | null, palette = false) => {
    // New only when some part of the page shows something no screen has
    const its = partsKeys(seed.desk, url, tree);
    if (parent && its.every((p) => seenParts.has(p))) return false;
    for (const p of its) seenParts.add(p);
    // Clicks that pick a subject in the URL (a route's `?op=`, a team's `?t=`): two stand for the rest
    const u = new URL(undemo(url), BASE);
    let siblings: MapScreen[] | undefined;
    if (parent && u.search !== new URL(parent.url, BASE).search) {
      const shape = `${parent.fp}|${u.pathname}?${[...u.searchParams.keys()].sort().join("&")}`;
      siblings = fanned.get(shape) ?? [];
      fanned.set(shape, siblings);
      if (siblings.length >= 2) {
        for (const k of varying(siblings[0].url, u.pathname + u.search)) if (!siblings[0].linkVaries.includes(k)) siblings[0].linkVaries.push(k);
        return false;
      }
    }
    const added = parent ? fresh(parent.tree, tree) : null;
    const shown = render(prune(added ? within(tree, added) : tree, isChrome)).join("\n");
    // The same thing opened from another desk (the theme picker): one screen
    if (added && screens.some((s) => s.trail.length > 0 && s.tree === shown)) return false;
    const steps = palette ? [{ role: "key", name: "⌘K" }] : trail.map(step);
    const screen: MapScreen = {
      id: palette ? `${base}/palette` : screenId(base, steps),
      desk: seed.desk,
      title: palette ? "Command palette (⌘K or Ctrl+K)" : trail.length ? trail.map(stepTitle).join(" › ") : seed.frontOnly ? `${label} (${undemo(url)})` : label,
      trail: steps,
      url: undemo(url),
      link: trail.length === 0 && !palette ? undemo(url) : null,
      linkVaries: [],
      tree: shown,
      fingerprint: fp,
      signedIn: !!seed.signedIn,
    };
    if (screens.some((s) => s.id === screen.id)) screen.id += `~${fp.slice(0, 4)}`;
    screens.push(screen);
    byFingerprint.set(fp, screen);
    partsOf.set(screen, its.join("\n"));
    siblings?.push(screen);
    if (++found >= MAX_SCREENS && !stop) stop = "screen limit reached";
    if (!palette) enqueue(trail, fp, tree, added);
    return true;
  };

  const worker = async () => {
    const ctx = await newContext(browser);
    const { page, settle } = await newPage(ctx);
    /** The fingerprint of what the page shows now, null when unknown. */
    let at: string | null = null;
    const look = async () => {
      const tree = await snapshot(page);
      at = fingerprintOf(page.url(), tree);
      return { tree, fp: at };
    };
    const open = async (trail: Act[]) => {
      work.loads++;
      if (seed.signedIn) await session(ctx);
      await page.goto(BASE + seed.url, { waitUntil: "load", timeout: 60_000 });
      await settle();
      for (const c of trail) {
        await act(page, c, 4000);
        await settle();
      }
      return look();
    };
    const back = async (fp: string) => {
      if (at === fp) return;
      await page.keyboard.press("Escape");
      await settle();
      await look();
    };

    try {
      for (;;) {
        if (!stop && Date.now() - started > SEED_MS) stop = "time limit reached";
        if (stop) break;
        const mine = jobs.findIndex((j) => j.fp === at);
        const job = jobs.splice(mine >= 0 ? mine : 0, 1)[0];
        if (!job) {
          if (busy === 0) break;
          await page.waitForTimeout(100);
          continue;
        }
        busy++;
        const path = (c?: Act) => [...job.trail, ...(c ? [c] : [])].map(stepTitle).join(" › ") || seed.url;
        try {
          if (job.action === "front") {
            const { tree, fp } = await open([]);
            const known = byFingerprint.get(fp);
            if (known) {
              // A link seed for a screen clicks already reached
              if (seed.frontOnly && !known.link) known.link = undemo(page.url());
              continue;
            }
            if (seed.frontOnly) {
              // The same parts as a screen clicks reached (Week's `?view=matchup` and its MATCHUP rail): that screen's link
              const its = partsKeys(seed.desk, page.url(), tree);
              const same = screens.find((s) => s.desk === seed.desk && partsOf.get(s) === its.join("\n"));
              if (same) {
                same.link ??= undemo(page.url());
                continue;
              }
              if (its.every((p) => seenParts.has(p))) continue;
              finding("link opens a screen no click reached", seed.desk, undemo(page.url()));
            }
            record([], page.url(), tree, fp, null);
            await audit(page, seed.desk);
            noteDesk(seed.desk, tree);
            if (!seed.frontOnly) jobs.push({ trail: [], fp, tree, action: "palette" });
            continue;
          }
          if (at !== job.fp && (await open(job.trail)).fp !== job.fp) {
            finding("replay failed", seed.desk, `${path()}: the clicks open another screen now`);
            continue;
          }
          const from = byFingerprint.get(job.fp)!;
          if (job.action === "palette") {
            // Its list is every command, the desk's own first
            await page.keyboard.press("Control+k");
            await settle();
            const { tree, fp } = await look();
            if (fp !== job.fp && !byFingerprint.has(fp)) record([], page.url(), tree, fp, { tree: job.tree, url: from.url, fp: job.fp }, true);
            await back(job.fp);
            continue;
          }
          const c = job.action;
          // A name that changed with a choice ("FPTS ▾" once sorted the other way): back to how the job saw it
          if ((await locate(page, c).count()) === 0 && (await open(job.trail)).fp !== job.fp) {
            finding("replay failed", seed.desk, `${path()}: the clicks open another screen now`);
            continue;
          }
          work.clicks++;
          await act(page, c, 3000);
          await settle();
          const { tree, fp } = await look();
          const seen = byFingerprint.get(fp);
          if (seen && seen !== from) {
            // Another of the same screen: the params that differ pick its subject
            for (const k of varying(seen.url, undemo(page.url()))) if (!seen.linkVaries.includes(k)) seen.linkVaries.push(k);
          } else if (fp !== job.fp && !queued.has(fp)) {
            queued.add(fp);
            if (record([...job.trail, c], page.url(), tree, fp, { tree: job.tree, url: from.url, fp: job.fp })) await audit(page, seed.desk);
          }
          // A URL the click wrote is a link to try for that screen
          if (undemo(page.url()) !== from.url) linkTries.push({ url: page.url().replace(BASE, ""), fp, signedIn: !!seed.signedIn });
          await back(job.fp);
        } catch (e) {
          finding(job.action === "palette" ? "palette failed" : "click failed", seed.desk, `${path(typeof job.action === "object" ? job.action : undefined)}: ${whyFailed(e)}`);
          at = null;
        } finally {
          busy--;
        }
      }
    } finally {
      await ctx.close();
    }
  };

  await Promise.all(Array.from({ length: seed.frontOnly ? 1 : WORKERS }, worker));
  if (stop) finding(stop, seed.desk, `${seed.url}: ${jobs.length} clicks left undone`);
}

const firstLine = (e: unknown) => String(e).split("\n")[0].slice(0, 100);

/**
 * Why a step gave up, from Playwright's call log: covered by another element
 * (a row's actions that only its selected row shows), not visible, not found.
 */
function whyFailed(e: unknown): string {
  const log = String(e).replace(/\x1b\[\d+m/g, "").split("\n");
  if (!/Timeout/.test(log[0])) return firstLine(e);
  const cover = log.map((l) => l.match(/<(\w+)([^>]*)>.*intercepts pointer events/)).filter(Boolean).at(-1);
  if (cover) {
    const label = cover[2].match(/\b(?:aria-label|title)="([^"]*)"/)?.[1];
    return `covered by ${cover[1]}${label ? ` “${label}”` : ""}`;
  }
  const state = log.map((l) => l.match(/element is (not \w+|outside of the viewport)/)).filter(Boolean).at(-1);
  if (state) return `element is ${state[1]}`;
  return log.some((l) => l.includes("locator resolved to")) ? firstLine(e) : "not on the page";
}

/** URLs clicks wrote, checked at the end: one that opens its screen on its own is that screen's link. */
const linkTries: { url: string; fp: string; signedIn: boolean }[] = [];

async function checkLinks(browser: Browser, signedIn: boolean) {
  const ctx = await newContext(browser);
  const { page, settle } = await newPage(ctx);
  const tried = new Set<string>();
  try {
    for (const t of linkTries) {
      const screen = byFingerprint.get(t.fp);
      if (t.signedIn !== signedIn || !screen || screen.link || tried.has(t.url)) continue;
      tried.add(t.url);
      try {
        if (signedIn) await session(ctx);
        await page.goto(BASE + t.url, { waitUntil: "load", timeout: 60_000 });
        await settle();
        if (fingerprintOf(page.url(), await snapshot(page)) === t.fp) screen.link = undemo(t.url);
      } catch {}
    }
  } finally {
    await ctx.close();
  }
}

/** A desk's facts from its front: its footer's keys. */
function noteDesk(id: string, tree: AriaNode[]) {
  const desk = desks.get(id);
  if (!desk || desk.keys) return;
  const footer = tree.find((n) => n.role === "contentinfo");
  desk.keys = footer?.value ?? (footer ? render(footer.children).join(" ").replace(/\s*- /g, " ").trim() : null);
}

/**
 * Whether a visitor without an account gets the desk or a sign-in prompt: a
 * redirect to sign-in (Draft, Account), or a page that is little more than a
 * prompt to sign in (Week, AI).
 */
async function needs(browser: Browser, href: string): Promise<"account" | null> {
  const ctx = await newContext(browser);
  const { page, settle } = await newPage(ctx);
  let toSignIn = false;
  page.on("response", (r) => {
    if (r.request().isNavigationRequest() && r.status() >= 300 && r.status() < 400 && /sign-in/.test(r.headers().location ?? "")) toSignIn = true;
  });
  try {
    try {
      await page.goto(BASE + href, { waitUntil: "load", timeout: 60_000 });
    } catch (e) {
      if (toSignIn) return "account"; // Clerk's hosted sign-in, off this build
      finding("desk didn't load", href, firstLine(e));
      return null;
    }
    await settle();
    if (toSignIn || new URL(page.url()).pathname.startsWith("/sign-in")) return "account";
    const body = render((await snapshot(page)).filter((n) => n.role !== "banner" && n.role !== "contentinfo"));
    return body.length <= 15 && body.some((l) => /\bSign in\b/.test(l)) ? "account" : null;
  } finally {
    await ctx.close();
  }
}

/**
 * Loads a public desk once so Clerk makes its visitor, and keeps the cookies.
 * Without Clerk the desks wait for it forever, so their signed-out prompts
 * never show: a finding, not a failure.
 */
async function clerkVisitor(browser: Browser) {
  const ctx = await newContext(browser);
  const { page } = await newPage(ctx);
  try {
    await page.goto(`${BASE}${ALL_DESKS.find((d) => d.id === "scout")?.href ?? "/"}`, { waitUntil: "load", timeout: 60_000 });
    const until = Date.now() + 20_000;
    let loaded = false;
    while (Date.now() < until && !loaded) {
      await page.waitForTimeout(250);
      loaded = await page.evaluate(() => Boolean((window as { Clerk?: { loaded?: boolean } }).Clerk?.loaded));
    }
    clerkCookies = (await ctx.cookies()).filter((c) => c.name.startsWith("__clerk_db_jwt"));
    if (!loaded) finding("Clerk didn't load", "all", `${CLERK_FAPI || "no publishable key"}: signed-out prompts show as loading`);
  } finally {
    await ctx.close();
  }
}

// ---- the account ----

/**
 * The app map's account (docs/APP_MAP_PLAN.md § 2): one sign-in for the run,
 * kept in a context of its own whose page stays open on a public desk. Every
 * signed-in context gets its cookies, and so the same session.
 */
let account: { ctx: BrowserContext; page: Page; token: string; at: number; minting: Promise<void> | null } | null = null;

/**
 * Signs in as the app map's account: a one-time ticket from the backend,
 * which mints one for that account and no other, redeemed with Clerk the way
 * a sign-in link would be. CI holds no password and no Clerk secret. Without
 * APP_MAP_TOKEN, or when a step fails (a finding), the crawl is signed out.
 */
async function signIn(browser: Browser): Promise<boolean> {
  const token = process.env.APP_MAP_TOKEN;
  if (!token) return false;
  if (!standIn) {
    finding("account pass skipped", "all", "it needs --serve: Clerk's production instance only answers its own site");
    return false;
  }
  let ticket: unknown;
  try {
    const res = await fetch(`${API}/v1/internal/app-map/sign-in-token`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`the sign-in token request was refused (HTTP ${res.status})`);
    ticket = ((await res.json()) as { data?: { ticket?: unknown } }).data?.ticket;
    if (typeof ticket !== "string" || !ticket) throw new Error("the sign-in token response had no ticket");
  } catch (e) {
    finding("sign-in failed", "all", firstLine(e));
    return false;
  }
  const ctx = await newContext(browser, { clerkWrites: true });
  const { page } = await newPage(ctx);
  try {
    await page.goto(`${BASE}${ALL_DESKS.find((d) => d.id === "scout")?.href ?? "/"}`, { waitUntil: "load", timeout: 60_000 });
    await page.waitForFunction(() => (window as ClerkWindow).Clerk?.loaded, null, { timeout: 30_000 });
    const status = await page.evaluate(async (t) => {
      const clerk = (window as ClerkWindow).Clerk!;
      const attempt = await clerk.client!.signIn.create({ strategy: "ticket", ticket: t });
      if (attempt.status !== "complete") return attempt.status ?? "incomplete";
      await clerk.setActive({ session: attempt.createdSessionId });
      return "complete";
    }, ticket);
    if (status !== "complete") throw new Error(`Clerk left the sign-in ${status}`);
  } catch (e) {
    finding("sign-in failed", "all", firstLine(e));
    await ctx.close();
    return false;
  }
  account = { ctx, page, token: "", at: 0, minting: null };
  return true;
}

/**
 * The run's session into a signed-in context, with a fresh token. Clerk's
 * middleware on /draft and /account checks the token without calling Clerk
 * (CLERK_JWT_KEY), but an expired one sends the page through Clerk's
 * handshake, which needs the secret key the build hasn't got. A token lasts a
 * minute, so one is minted when the last is 20 s old.
 */
async function session(ctx: BrowserContext) {
  const a = account;
  if (!a) return;
  if (Date.now() - a.at > 20_000) {
    a.minting ??= (async () => {
      const token = await a.page.evaluate(async () => (await (window as ClerkWindow).Clerk?.session?.getToken({ skipCache: true })) ?? null);
      if (!token) throw new Error("the account's session has ended");
      a.token = token;
      a.at = Date.now();
    })().finally(() => {
      a.minting = null;
    });
    await a.minting;
  }
  const cookies = (await a.ctx.cookies()).map((c) => (c.name.startsWith("__session") ? { ...c, value: a.token } : c));
  if (!cookies.some((c) => c.name.startsWith("__session"))) cookies.push({ name: "__session", value: a.token, domain: new URL(BASE).hostname, path: "/", expires: -1, httpOnly: false, secure: true, sameSite: "Lax" });
  await ctx.addCookies(cookies);
}

/** Ends the run's session, so no session outlives the crawl. */
async function signOut() {
  if (!account) return;
  try {
    await account.page.evaluate(() => (window as ClerkWindow).Clerk?.signOut());
  } catch (e) {
    finding("sign-out failed", "all", firstLine(e));
  }
  await account.ctx.close();
  account = null;
}

// ---- the run ----

async function pool<T>(items: T[], size: number, fn: (t: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift()!);
  }));
}

/** "/draft/demo-2/recap" → "/draft/[id]/recap": routes found by following links, one pattern each. */
const routeOf = (path: string) => path.replace(/\/(demo-\d+|\d+)(?=\/|$)/g, "/[id]");

async function main() {
  const t0 = Date.now();
  if (SERVE) standIn = startStandIn();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox", ...(standIn?.args ?? [])] });
  await clerkVisitor(browser);
  const chosen = ALL_DESKS.filter((d) => ONLY.length === 0 || ONLY.includes(d.id));
  for (const d of chosen) {
    desks.set(d.id, { id: d.id, label: d.label, href: d.href, note: d.note, keywords: d.keywords, needs: await needs(browser, d.href), keys: null });
  }

  // Signed in first: what a user has is the map, and the demos add only what it didn't show
  const passes = (await signIn(browser)) ? [true, false] : [false];
  for (const signedIn of passes) {
    /** A desk's URL as this pass opens it: as it is signed in, its demo signed out. */
    const at = (path: string, query = "") => (signedIn ? `${path}${query ? `?${query}` : ""}` : `${path}?demo=1${query ? `&${query}` : ""}`);

    // The desks' fronts first, then the routes their links lead to (draft rooms, recaps)
    const seeds: Seed[] = chosen.map((d) => ({ desk: d.id, url: at(d.href), signedIn }));
    await pool(seeds, SEEDS_AT_ONCE, (s) => explore(browser, s));

    const linked = new Map<string, string>();
    for (const s of screens.filter((x) => x.signedIn === signedIn)) {
      for (const m of s.tree.matchAll(/\/url: (\/[^\s]*)/g)) {
        const path = new URL(m[1], BASE).pathname;
        const desk = chosen.find((d) => path.startsWith(`${d.href}/`));
        if (desk && !seeds.some((x) => new URL(x.url, BASE).pathname === path)) {
          const key = routeOf(path);
          const list = [...linked.entries()].filter(([, k]) => k === key);
          if (list.length < 3) linked.set(path, key);
        }
      }
    }
    const more: Seed[] = [...linked.keys()].map((path) => ({ desk: chosen.find((d) => path.startsWith(`${d.href}/`))!.id, url: at(path), signedIn }));
    await pool(more, SEEDS_AT_ONCE, (s) => explore(browser, s));

    // Links a page reads but never writes (Week's ?view=, ?market=; Account's ?add): try each value
    const tries: Seed[] = [];
    for (const d of chosen) {
      const page = files.find((f) => f === `src/app/(desk)${d.href}/page.tsx`);
      if (!page) continue;
      for (const [k, values] of Object.entries(pageParams(readFileSync(page, "utf8")))) {
        for (const v of values) tries.push({ desk: d.id, url: at(d.href, `${k}=${encodeURIComponent(v)}`), frontOnly: true, signedIn });
      }
    }
    await pool(tries, SEEDS_AT_ONCE, (s) => explore(browser, s));
    await checkLinks(browser, signedIn);
  }
  await signOut();
  await browser.close();
  standIn?.stop();

  // Coverage: copy no screen showed is what the map knows only from the source
  const corpus = screens.map((s) => s.tree).join("\n");
  const seen = seenIn(corpus);
  const copy: MapCopy[] = copyByFile.map(({ file, strings }) => ({
    file,
    desk: deskOfFile(file),
    seen: strings.filter(seen),
    unseen: strings.filter((s) => !seen(s)),
  }));

  const map: AppMap = {
    version: APP_MAP_VERSION,
    build: BUILD,
    crawledAt: new Date().toISOString(),
    desks: [...desks.values()],
    screens,
    copy,
    findings,
  };
  writeFileSync(OUT, `${JSON.stringify(map, null, 1)}\n`);
  const seconds = Math.round((Date.now() - t0) / 1000);
  const text = summary(map, seconds);
  if (SUMMARY) appendFileSync(SUMMARY, text);
  console.log(text);
}

function summary(map: AppMap, seconds: number): string {
  const tokens = (s: string) => Math.round(s.length / 3.5);
  const signedInCount = map.screens.filter((s) => s.signedIn).length;
  const rows = map.desks.map((d) => {
    const ss = map.screens.filter((s) => s.desk === d.id);
    return `| ${d.label} | ${ss.length} | ${ss.filter((s) => s.link).length} | ${tokens(ss.map((s) => s.tree).join("\n")).toLocaleString()} | ${d.needs ?? "nothing"} |`;
  });
  const strings = map.copy.reduce((n, c) => n + c.seen.length + c.unseen.length, 0);
  const seenCount = map.copy.reduce((n, c) => n + c.seen.length, 0);
  const gaps = map.copy
    .filter((c) => c.unseen.length >= 5)
    .sort((a, b) => b.unseen.length - a.unseen.length)
    .slice(0, 15)
    .map((c) => `| \`${c.file}\` | ${c.unseen.length} of ${c.seen.length + c.unseen.length} | ${c.unseen.slice(0, 2).map((s) => `“${s.slice(0, 50)}”`).join(", ")} |`);
  const byKind = new Map<string, AppMap["findings"]>();
  for (const f of map.findings) byKind.set(f.kind, [...(byKind.get(f.kind) ?? []), f]);
  const byEndpoint = new Map<string, number>();
  for (const b of blocked) {
    const [method, url] = b.split(" ");
    const u = new URL(url);
    const key = `${method} ${u.host}${u.pathname.replace(/\/[^/]*\d[^/]*(?=\/|$)/g, "/{id}")}`;
    byEndpoint.set(key, (byEndpoint.get(key) ?? 0) + 1);
  }
  const writes = [...byEndpoint.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `- \`${k}\` ×${n}`);
  const found = [...byKind.entries()].map(([k, fs]) => `- **${k}** (${fs.length}): ${fs.slice(0, 3).map((f) => `${f.desk}: \`${f.detail.replace(/`/g, "'")}\``).join("; ")}`);
  return [
    `## App map for \`${map.build.slice(0, 7)}\``,
    "",
    `${map.screens.length} screens in ${seconds} s (${work.clicks} clicks, ${work.loads} page loads). ${blocked.length} write requests blocked.`,
    "",
    signedInCount ? `${signedInCount} screens signed in as the app map's account; the rest signed out, through the demos and the public desks.` : "Signed out only: through the demos and the public desks.",
    "",
    "| Desk | Screens | Links | Tokens | Needs |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    `### Copy no screen showed (${strings - seenCount} of ${strings} strings)`,
    "",
    "What CV AI knows only from the source. Closing a gap is product work, such as a demo that shows it.",
    "",
    "| File | Unseen | For example |",
    "|---|---|---|",
    ...gaps,
    "",
    "### Findings",
    "",
    ...(found.length ? found : ["None."]),
    "",
    `### Writes blocked (${blocked.length})`,
    "",
    "What pages tried to send, by endpoint: a read sent as a POST shows here as a screen that couldn't load.",
    "",
    ...(writes.length ? writes : ["None."]),
    "",
  ].join("\n");
}

await main();
