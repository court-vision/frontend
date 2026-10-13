import { preconnect, preload } from "react-dom";
import { isDeskPath } from "@/components/desk/routes";

/**
 * Warming Clerk from the pages that don't run it (the landing): a sign-in or
 * sign-up link there leads into (desk)/layout.tsx's ClerkProvider, which only
 * then fetches clerk-js and its UI bundle. Hinting the browser the moment a
 * pointer rests on such a link, or presses or focuses it, starts both
 * downloads and the Frontend API's connection before the click.
 *
 * Measured on a local build against the development instance, empty HTTP
 * cache, click to Clerk's sign-in field (2026-10-13): 640-940 ms with no
 * pointer before the click, 570-610 ms after resting on the link for 250 ms
 * (the scripts were in by the click). What remains is clerk-js starting up,
 * its Frontend API calls and the UI's lazy chunks, which only a clerk-js that
 * is already running skips (~60 ms): the price of a landing without Clerk.
 *
 * The URLs are the ones @clerk/nextjs writes into a ClerkProvider page,
 * computed the same way without importing Clerk (a landing that imports
 * @clerk ships it: src/lib/__tests__/clerk-scope.test.ts).
 * src/lib/__tests__/clerk-warm.test.ts holds them to the SDK's own answer,
 * pinned versions included.
 */

export type ClerkEnv = {
  publishableKey?: string;
  clerkJSUrl?: string;
  clerkJSVersion?: string;
  clerkUIUrl?: string;
  clerkUIVersion?: string;
  proxyUrl?: string;
  domain?: string;
};

/**
 * The variables @clerk/nextjs builds its script tags from (its
 * mergeNextClerkPropsWithEnv), each spelled out so Next inlines it into the
 * browser bundle.
 */
export function clerkEnv(): ClerkEnv {
  return {
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    clerkJSUrl: process.env.NEXT_PUBLIC_CLERK_JS_URL,
    clerkJSVersion: process.env.NEXT_PUBLIC_CLERK_JS_VERSION,
    clerkUIUrl: process.env.NEXT_PUBLIC_CLERK_UI_URL,
    clerkUIVersion: process.env.NEXT_PUBLIC_CLERK_UI_VERSION,
    proxyUrl: process.env.NEXT_PUBLIC_CLERK_PROXY_URL,
    domain: process.env.NEXT_PUBLIC_CLERK_DOMAIN,
  };
}

// Without a pinned version Clerk loads the major its SDK was built for.
const CLERK_JS_MAJOR = "6";
const CLERK_UI_MAJOR = "1";

export type ClerkWarmTargets = { frontendApi: string; clerkJS: string; clerkUI: string };

/**
 * Where a ClerkProvider page will go first: its Frontend API origin and the two
 * scripts. Null when this build can't say for sure (no key, or a proxy or
 * satellite domain, which move the scripts); then nothing is warmed.
 */
export function clerkWarmTargets(env: ClerkEnv = clerkEnv()): ClerkWarmTargets | null {
  if (env.proxyUrl || env.domain) return null;
  const encoded = /^pk_(?:live|test)_([A-Za-z0-9+/=_-]+)$/.exec(env.publishableKey ?? "")?.[1];
  if (!encoded) return null;
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return null;
  }
  // `<frontend api host>$`, as Clerk checks it.
  const host = decoded.slice(0, -1);
  if (!decoded.endsWith("$") || host.includes("$") || !host.includes(".")) return null;
  const origin = `https://${host}`;
  return {
    frontendApi: origin,
    clerkJS: env.clerkJSUrl || `${origin}/npm/@clerk/clerk-js@${env.clerkJSVersion || CLERK_JS_MAJOR}/dist/clerk.browser.js`,
    clerkUI: env.clerkUIUrl || `${origin}/npm/@clerk/ui@${env.clerkUIVersion || CLERK_UI_MAJOR}/dist/ui.browser.js`,
  };
}

/** Whether a same-origin path renders inside (desk)/layout.tsx's ClerkProvider. */
export function leadsIntoClerk(pathname: string): boolean {
  return isDeskPath(pathname) || /^\/sign-(?:in|up)(?:\/|$)/.test(pathname);
}

/**
 * Start Clerk's downloads and connection now. React keeps one of each hint, so
 * calling this again is free. The scripts are fetched as @clerk/nextjs's tags
 * fetch them (crossorigin anonymous), or the browser would fetch them twice;
 * the Frontend API's calls carry cookies, so its connection is the credentialed
 * one (no crossorigin).
 */
export function warmClerk(targets: ClerkWarmTargets | null = clerkWarmTargets()): void {
  if (!targets) return;
  preconnect(targets.frontendApi);
  preload(targets.clerkJS, { as: "script", crossOrigin: "anonymous" });
  preload(targets.clerkUI, { as: "script", crossOrigin: "anonymous" });
}
