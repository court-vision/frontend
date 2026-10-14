import { describe, expect, test } from "bun:test";
import { hasSessionHint, isRouterRequest } from "../session-hint";

/** Cookies as `a=1; b=2`, the way a request carries them. */
function cookies(header: string) {
  return header
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const at = c.indexOf("=");
      return { name: c.slice(0, at), value: c.slice(at + 1) };
    });
}

describe("hasSessionHint", () => {
  test("a browser Clerk's Frontend API last saw signed in", () => {
    for (const header of [
      "__client_uat=1760000000",
      "__client_uat_Xk9Q2bLm=1760000000",
      "theme=midnight; __client_uat=1760000000",
      // Clerk keeps both while it moves a browser to the suffixed name.
      "__client_uat=0; __client_uat_Xk9Q2bLm=1760000000",
      "__client_uat=1760000000; __client_uat_Xk9Q2bLm=0",
    ]) {
      expect(hasSessionHint(cookies(header))).toBe(true);
    }
  });

  test("signed out, never signed in, or nothing Clerk would read as a time", () => {
    for (const header of [
      "",
      "__client_uat=0",
      "__client_uat=0; __client_uat_Xk9Q2bLm=0",
      "__client_uat=",
      "__client_uat=abc",
      "__client_uat=-5",
      // A session token alone is not the hint (Clerk wants both to skip the handshake).
      "__session=eyJhbGciOiJSUzI1NiJ9.e30.sig",
      "__client=abc; theme=midnight",
      "x__client_uat=1760000000",
      "__client_uatx=1760000000",
    ]) {
      expect(hasSessionHint(cookies(header))).toBe(false);
    }
  });
});

describe("isRouterRequest", () => {
  const req = (method: string, headers: Record<string, string> = {}) => ({ method, headers: new Headers(headers) });

  test("the client router's prefetches, navigations and refreshes", () => {
    expect(isRouterRequest(req("GET", { "Next-Url": "/week" }))).toBe(true);
  });

  test("a document load, or a server action, is not", () => {
    expect(isRouterRequest(req("GET", { "Sec-Fetch-Dest": "document", Accept: "text/html" }))).toBe(false);
    expect(isRouterRequest(req("GET"))).toBe(false);
    expect(isRouterRequest(req("POST", { "Next-Url": "/account", "Next-Action": "abc" }))).toBe(false);
  });
});
