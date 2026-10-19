/**
 * What the app map's crawl lets through to Clerk (docs/APP_MAP_PLAN.md § 2).
 * Every write a page tries is aborted except these, which only keep the page
 * as it is: refreshing the session's token, touching the session, and a
 * development instance's visitor. Signing in and out happen in the crawl's
 * own context, never from a click.
 */

/** Clerk's Frontend API host, from a publishable key (`pk_test_` or `pk_live_` + base64 of "host$"). */
export function clerkFrontendApi(publishableKey: string): string {
  try {
    return atob(publishableKey.split("_")[2] ?? "").replace(/\$$/, "");
  } catch {
    return "";
  }
}

const KEEP_ALIVE = /^\/v1\/(?:client\/sessions\/[^/]+\/(?:tokens(?:\/[^/]+)?|touch)|dev_browser)$/;

/**
 * Whether a write to Clerk's Frontend API only keeps the page's session alive.
 * clerk-js sends every write as a POST and names any other method in
 * `_method` (a sign-out is a POST with `_method=DELETE`).
 */
export function keepsSessionAlive(url: string, method: string): boolean {
  const u = new URL(url);
  const named = (u.searchParams.get("_method") ?? method).toUpperCase();
  return method.toUpperCase() === "POST" && named === "POST" && KEEP_ALIVE.test(u.pathname);
}
