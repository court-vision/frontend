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
 * The cost: production no longer picks up a Clerk release on its own. Unpinned,
 * a new clerk-js reached every page the day Clerk shipped it; pinned, it waits
 * for a bump here. 6.39.0 / 1.40.0 were what the floating majors resolved to
 * on 2026-10-13, so pinning changed nothing about which code ran that day, but
 * every Clerk release since leaves the pin behind until someone moves it
 * (`bun run check:clerk-pins` prints where the majors resolve now):
 * - before merging a pin change, run `bun run check:clerk-pins`;
 * - the weekly Clerk Pin Drift workflow runs it too and goes red when Clerk has
 *   shipped past the pin: bump both to the versions it prints;
 * - on a @clerk/nextjs upgrade, the guard in
 *   src/lib/__tests__/clerk-scripts.test.ts fails if the SDK now asks for
 *   another major or was built against a newer release than the pin.
 */
export const CLERK_JS_VERSION = "6.39.0";
export const CLERK_UI_VERSION = "1.40.0";
