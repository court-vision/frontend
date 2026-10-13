/**
 * The exact Clerk script versions every page loads.
 *
 * Unpinned, @clerk/nextjs writes major-only URLs into the HTML
 * (`clerk.courtvision.dev/npm/@clerk/clerk-js@6/...`, `@clerk/ui@1/...`), and
 * Clerk's CDN answers those with a `no-store` 307 to the current release on
 * every page load, cached or not: one extra round trip before clerk-js can run,
 * and so before any signed-in desk's first API call. The exact-version URLs are
 * `immutable` 200s. next.config.mjs hands these to @clerk/nextjs through
 * NEXT_PUBLIC_CLERK_JS_VERSION / NEXT_PUBLIC_CLERK_UI_VERSION (read at build
 * time by its mergeNextClerkPropsWithEnv).
 *
 * The values are the releases the floating majors resolved to on 2026-10-13
 * (`curl -sI https://clerk.courtvision.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js`
 * and the same for `@clerk/ui@1/dist/ui.browser.js`), so pinning changed which
 * code runs by nothing. Bump both whenever @clerk/nextjs is upgraded: re-run
 * those two curls and copy the `location` versions here. The guard in
 * src/lib/__tests__/clerk-scripts.test.ts fails when the installed SDK asks
 * for another major, or was built against a newer release than the pin.
 */
export const CLERK_JS_VERSION = "6.39.0";
export const CLERK_UI_VERSION = "1.40.0";
