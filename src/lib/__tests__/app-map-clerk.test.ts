import { describe, expect, test } from "bun:test";
import { clerkFrontendApi, keepsSessionAlive } from "@/lib/app-map/clerk";

const FAPI = "https://clerk.courtvision.dev";

describe("clerkFrontendApi", () => {
  test("reads the host out of a live or test key", () => {
    expect(clerkFrontendApi("pk_live_Y2xlcmsuY291cnR2aXNpb24uZGV2JA")).toBe("clerk.courtvision.dev");
    expect(clerkFrontendApi(`pk_test_${btoa("calm-owl-12.clerk.accounts.dev$")}`)).toBe("calm-owl-12.clerk.accounts.dev");
  });

  test("is empty for no key or a malformed one", () => {
    expect(clerkFrontendApi("")).toBe("");
    expect(clerkFrontendApi("pk_live_%%%")).toBe("");
  });
});

describe("keepsSessionAlive", () => {
  test("lets a token refresh, a touch and a visitor through", () => {
    expect(keepsSessionAlive(`${FAPI}/v1/client/sessions/sess_1/tokens?__clerk_api_version=2025-11-10`, "POST")).toBe(true);
    expect(keepsSessionAlive(`${FAPI}/v1/client/sessions/sess_1/tokens/supabase`, "POST")).toBe(true);
    expect(keepsSessionAlive(`${FAPI}/v1/client/sessions/sess_1/touch`, "POST")).toBe(true);
    expect(keepsSessionAlive(`${FAPI}/v1/dev_browser`, "POST")).toBe(true);
  });

  test("stops signing in, signing out and account changes", () => {
    expect(keepsSessionAlive(`${FAPI}/v1/client/sign_ins`, "POST")).toBe(false);
    expect(keepsSessionAlive(`${FAPI}/v1/client/sessions/sess_1/end`, "POST")).toBe(false);
    expect(keepsSessionAlive(`${FAPI}/v1/client/sessions/sess_1/remove`, "POST")).toBe(false);
    expect(keepsSessionAlive(`${FAPI}/v1/me?_method=PATCH`, "POST")).toBe(false);
    expect(keepsSessionAlive(`${FAPI}/v1/client?_method=DELETE`, "POST")).toBe(false);
  });

  test("goes by the method clerk-js names, not the one it sends", () => {
    expect(keepsSessionAlive(`${FAPI}/v1/client/sessions/sess_1/touch?_method=DELETE`, "POST")).toBe(false);
    expect(keepsSessionAlive(`${FAPI}/v1/client/sessions/sess_1/tokens`, "PUT")).toBe(false);
  });
});
