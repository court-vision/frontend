import { afterEach, describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { clerkWarmTargets, leadsIntoClerk, warmClerk } from "../clerk-warm";

/**
 * The landing warms exactly what a ClerkProvider page then loads. A hint for
 * any other URL is a wasted download (and clerk-js fetched twice), so the
 * targets are held to what @clerk/nextjs itself writes into the HTML: its
 * script tags rendered from its own reading of the environment.
 */
const nextEntry = createRequire(import.meta.url).resolve("@clerk/nextjs");
const fromNext = createRequire(nextEntry);
const { mergeNextClerkPropsWithEnv } = fromNext(join(dirname(nextEntry), "utils/mergeNextClerkPropsWithEnv.js")) as {
  mergeNextClerkPropsWithEnv: (props: object) => Record<string, unknown>;
};
const { ClerkScriptTags } = fromNext(join(dirname(nextEntry), "utils/clerk-script-tags.js")) as {
  ClerkScriptTags: FunctionComponent<Record<string, unknown>>;
};

const VARS = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_CLERK_JS_URL",
  "NEXT_PUBLIC_CLERK_JS_VERSION",
  "NEXT_PUBLIC_CLERK_UI_URL",
  "NEXT_PUBLIC_CLERK_UI_VERSION",
  "NEXT_PUBLIC_CLERK_PROXY_URL",
  "NEXT_PUBLIC_CLERK_DOMAIN",
] as const;
const saved = Object.fromEntries(VARS.map((v) => [v, process.env[v]]));
afterEach(() => {
  for (const v of VARS) {
    if (saved[v] === undefined) delete process.env[v];
    else process.env[v] = saved[v];
  }
});

function setEnv(env: Partial<Record<(typeof VARS)[number], string>>) {
  for (const v of VARS) delete process.env[v];
  Object.assign(process.env, env);
}

const attr = (html: string, tag: string, name: string) =>
  new RegExp(`<${tag}\\b[^>]*\\s${name}="([^"]*)"`).exec(html)?.[1] ?? null;

/** What a ClerkProvider page's HTML asks for, as @clerk/nextjs renders it. */
function sdkTags() {
  const html = renderToStaticMarkup(createElement(ClerkScriptTags, mergeNextClerkPropsWithEnv({})));
  return {
    clerkJS: attr(html, "script", "src"),
    clerkJSCors: attr(html, "script", "crossorigin"),
    clerkUI: attr(html, "link", "href"),
    clerkUICors: attr(html, "link", "crossorigin"),
  };
}

const key = (prefix: "live" | "test", host: string) => `pk_${prefix}_${btoa(`${host}$`)}`;

describe("clerkWarmTargets", () => {
  test("names the scripts @clerk/nextjs writes into a ClerkProvider page", () => {
    const cases = [
      // Production as it is: floating majors.
      { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: key("live", "clerk.courtvision.test") },
      // Pinned exact versions (frontend#76's next.config.mjs sets these).
      {
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: key("live", "clerk.courtvision.test"),
        NEXT_PUBLIC_CLERK_JS_VERSION: "6.39.0",
        NEXT_PUBLIC_CLERK_UI_VERSION: "1.40.0",
      },
      // Explicit URLs win over versions.
      {
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: key("live", "clerk.courtvision.test"),
        NEXT_PUBLIC_CLERK_JS_URL: "https://cdn.example.test/clerk.browser.js",
        NEXT_PUBLIC_CLERK_JS_VERSION: "6.39.0",
        NEXT_PUBLIC_CLERK_UI_URL: "https://cdn.example.test/ui.browser.js",
      },
      // A development instance, as local builds and CI use.
      { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: key("test", "made-up-otter-12.clerk.accounts.dev") },
    ];
    for (const env of cases) {
      setEnv(env);
      const sdk = sdkTags();
      const ours = clerkWarmTargets();
      expect({ env, clerkJS: ours?.clerkJS, clerkUI: ours?.clerkUI }).toEqual({ env, clerkJS: sdk.clerkJS!, clerkUI: sdk.clerkUI! });
      // Fetched in cors mode, which the warm-up's preloads must match.
      expect([sdk.clerkJSCors, sdk.clerkUICors]).toEqual(["anonymous", "anonymous"]);
    }
  });

  test("the Frontend API is the key's host", () => {
    expect(clerkWarmTargets({ publishableKey: key("live", "clerk.courtvision.test") })?.frontendApi).toBe("https://clerk.courtvision.test");
  });

  test("warms nothing it can't be sure of", () => {
    const pk = key("live", "clerk.courtvision.test");
    for (const env of [
      {},
      { publishableKey: "" },
      { publishableKey: "sk_live_abc" },
      { publishableKey: "pk_live_%%%" },
      { publishableKey: `pk_live_${btoa("clerk.courtvision.test")}` },
      { publishableKey: `pk_live_${btoa("localhost$")}` },
      // A proxy or satellite domain moves the scripts somewhere else.
      { publishableKey: pk, proxyUrl: "/__clerk" },
      { publishableKey: pk, domain: "courtvision.test" },
    ]) {
      expect({ env, targets: clerkWarmTargets(env) }).toEqual({ env, targets: null });
    }
  });
});

describe("leadsIntoClerk", () => {
  test("the desks and Clerk's own forms", () => {
    for (const path of ["/sign-in", "/sign-in/factor-one", "/sign-up", "/sign-up/verify", "/week", "/draft/12", "/scout", "/developer", "/account"]) {
      expect({ path, clerk: leadsIntoClerk(path) }).toEqual({ path, clerk: true });
    }
  });

  test("not the pages without Clerk", () => {
    for (const path of ["/", "/privacy", "/sign-inx", "/weekly", "/no-such-page"]) {
      expect({ path, clerk: leadsIntoClerk(path) }).toEqual({ path, clerk: false });
    }
  });
});

describe("warmClerk", () => {
  test("opens the Frontend API's connection and preloads both scripts the way Clerk fetches them", () => {
    const targets = clerkWarmTargets({ publishableKey: key("live", "clerk.courtvision.test"), clerkJSVersion: "6.39.0", clerkUIVersion: "1.40.0" });
    const Warm = () => {
      warmClerk(targets);
      warmClerk(targets);
      return null;
    };
    const html = renderToStaticMarkup(createElement("html", null, createElement("head"), createElement("body", null, createElement(Warm))));
    const links = html.match(/<link [^>]*>/g) ?? [];
    expect(links).toEqual([
      // Credentialed (no crossorigin): the Frontend API's calls carry cookies.
      '<link rel="preconnect" href="https://clerk.courtvision.test"/>',
      // crossorigin="" is anonymous, as Clerk's crossorigin="anonymous" tags are.
      '<link rel="preload" href="https://clerk.courtvision.test/npm/@clerk/clerk-js@6.39.0/dist/clerk.browser.js" as="script" crossorigin=""/>',
      '<link rel="preload" href="https://clerk.courtvision.test/npm/@clerk/ui@1.40.0/dist/ui.browser.js" as="script" crossorigin=""/>',
    ]);
  });

  test("does nothing without targets", () => {
    const Warm = () => {
      warmClerk(null);
      return null;
    };
    const html = renderToStaticMarkup(createElement("html", null, createElement("head"), createElement("body", null, createElement(Warm))));
    expect(html).not.toContain("<link");
  });
});
