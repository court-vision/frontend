/**
 * Loaded before every test file (bunfig.toml). Clerk reads its keys once, when
 * its modules first load, and test files reach Clerk through the hooks they
 * import, so the keys proxy.test.ts runs Clerk with have to be in place before
 * any of them. They name a made-up production instance and replace whatever
 * `bun test` loaded from a local .env: no test may talk to a real Clerk.
 */
export const TEST_CLERK_FAPI = "clerk.courtvision.test";

Object.assign(process.env, {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_live_${btoa(`${TEST_CLERK_FAPI}$`)}`,
  CLERK_SECRET_KEY: "sk_live_test_only",
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
  NEXT_PUBLIC_CLERK_DOMAIN: "",
  NEXT_PUBLIC_CLERK_PROXY_URL: "",
  NEXT_PUBLIC_CLERK_IS_SATELLITE: "",
  CLERK_API_URL: "",
});
