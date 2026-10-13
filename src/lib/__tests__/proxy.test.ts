import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { type NextFetchEvent, NextRequest } from "next/server";
import proxy from "@/proxy";
import { TEST_CLERK_FAPI } from "./preload";

/**
 * The proxy end to end: which requests Clerk's middleware sees, and what the
 * rest get instead. Clerk runs for real against the made-up production
 * instance preload.ts names. The only network call it may make is for its
 * signing keys, answered here; anything else fails the test.
 */
const FAPI = TEST_CLERK_FAPI;
const ORIGIN = "https://www.courtvision.dev";

// A signing key standing in for the instance's, served as its JWKS.
const KID = "ins_proxy_test";
const keys = (await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
)) as CryptoKeyPair;
const jwk = { ...(await crypto.subtle.exportKey("jwk", keys.publicKey)), kid: KID, alg: "RS256", use: "sig" };

const b64url = (data: string | ArrayBuffer) => Buffer.from(typeof data === "string" ? data : new Uint8Array(data)).toString("base64url");
const now = () => Math.floor(Date.now() / 1000);

/** A Clerk session token for user_test, issued `age` seconds ago and good for 60 s. */
async function sessionToken(age = 0): Promise<string> {
  const iat = now() - age;
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: KID }));
  const payload = b64url(JSON.stringify({ sub: "user_test", sid: "sess_test", iss: `https://${FAPI}`, azp: ORIGIN, iat, nbf: iat - 5, exp: iat + 60 }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(sig)}`;
}

const realFetch = globalThis.fetch;
let unexpected: string[] = [];
beforeAll(() => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (new URL(url).pathname.endsWith("/jwks")) return Response.json({ keys: [jwk] });
    unexpected.push(url);
    throw new Error(`unexpected network call: ${url}`);
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});
beforeEach(() => {
  unexpected = [];
});

const DOCUMENT = { "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate", Accept: "text/html,application/xhtml+xml" };
// What the client router sends on a prefetch or navigation, as far as the
// proxy can see (Next strips RSC and Next-Router-Prefetch before it runs).
const ROUTER = { "Next-Url": "/week" };
const HINT = "__client_uat=1760000000";

async function run(path: string, headers: Record<string, string> = {}, cookie = "", method = "GET") {
  const req = new NextRequest(new URL(path, ORIGIN), { method, headers: { ...headers, ...(cookie ? { cookie } : {}) } });
  const res = await proxy(req, {} as NextFetchEvent);
  expect(unexpected).toEqual([]);
  return {
    status: res?.status ?? 200,
    location: res?.headers.get("location") ?? null,
    rewrite: res?.headers.get("x-middleware-rewrite") ?? null,
    // Clerk's verdict: on the response when it answers itself, on the request
    // it forwards to the page otherwise.
    clerk: res?.headers.get("x-clerk-auth-status") ?? res?.headers.get("x-middleware-request-x-clerk-auth-status") ?? null,
  };
}

describe("pages Clerk's middleware no longer sees", () => {
  test("a returning signed-in browser loads Week, Scout and Developer without a handshake", async () => {
    for (const path of ["/week", "/week?view=players", "/scout", "/scout?p=203999", "/developer", "/privacy", "/no-such-page"]) {
      const r = await run(path, DOCUMENT, HINT);
      expect(r.clerk).toBeNull();
      expect(r.location).toBeNull();
      expect(r.status).toBe(200);
    }
  });

  test("a bare desk flag is still given a value, Clerk or not", async () => {
    for (const cookie of ["", HINT]) {
      expect((await run("/week?demo", DOCUMENT, cookie)).rewrite).toBe(`${ORIGIN}/week?demo=1`);
      expect((await run("/week?market", DOCUMENT, cookie)).rewrite).toBe(`${ORIGIN}/week?market=1`);
      expect((await run("/scout?demo", DOCUMENT, cookie)).rewrite).toBe(`${ORIGIN}/scout?demo=1`);
    }
    expect((await run("/week?demo=1", DOCUMENT)).rewrite).toBeNull();
    expect((await run("/privacy?demo", DOCUMENT)).rewrite).toBeNull();
  });

  test("the front door sends a browser that holds a session to its Week desk", async () => {
    for (const cookie of [HINT, "__client_uat_Xk9Q2bLm=1760000000", `theme=paper; ${HINT}`]) {
      for (const headers of [DOCUMENT, ROUTER, {}]) {
        const r = await run("/", headers, cookie);
        expect(r.status).toBe(307);
        expect(r.location).toBe(`${ORIGIN}/week`);
        expect(r.clerk).toBeNull();
      }
    }
    expect((await run("/?utm_source=x", DOCUMENT, HINT)).location).toBe(`${ORIGIN}/week`);
  });

  test("and serves everyone else the landing page", async () => {
    for (const cookie of ["", "__client_uat=0", "theme=paper"]) {
      const r = await run("/", DOCUMENT, cookie);
      expect(r.status).toBe(200);
      expect(r.location).toBeNull();
      expect(r.clerk).toBeNull();
    }
  });
});

describe("routes Clerk still guards", () => {
  test("Draft and Account send a signed-out browser to sign-in", async () => {
    for (const path of ["/draft", "/draft/12", "/draft/12/recap", "/account", "/account?add"]) {
      const r = await run(path, DOCUMENT);
      expect(r.status).toBe(307);
      expect(r.location).toStartWith(`${ORIGIN}/sign-in?redirect_url=`);
      expect(r.clerk).toBe("signed-out");
    }
  });

  test("and refresh a stale session through Clerk's handshake, as before", async () => {
    for (const path of ["/draft", "/account", "/account?yahoo_connected=1", "/sign-in", "/sign-up", "/sign-in/factor-one"]) {
      const r = await run(path, DOCUMENT, HINT);
      expect(r.status).toBe(307);
      expect(r.location).toStartWith(`https://${FAPI}/v1/client/handshake?redirect_url=`);
      expect(r.clerk).toBe("handshake");
    }
    const expired = await sessionToken(120);
    const r = await run("/account", DOCUMENT, `__client_uat=${now() - 200}; __session=${expired}`);
    expect(r.location).toStartWith(`https://${FAPI}/v1/client/handshake?redirect_url=`);
  });

  test("a verified session opens them, by document and by the router", async () => {
    const cookie = `__client_uat=${now() - 10}; __session=${await sessionToken()}`;
    for (const headers of [DOCUMENT, ROUTER]) {
      for (const path of ["/draft", "/draft/12", "/account", "/account?add"]) {
        const r = await run(path, headers, cookie);
        expect(r.clerk).toBe("signed-in");
        expect(r.location).toBeNull();
        expect(r.status).toBe(200);
      }
    }
    expect((await run("/account?add", DOCUMENT, cookie)).rewrite).toBe(`${ORIGIN}/account?add=1`);
  });

  test("a desk's demo opens signed out, and keeps its flag", async () => {
    for (const path of ["/draft?demo", "/account?demo", "/draft/demo-3", "/draft/demo-3/recap"]) {
      const r = await run(path, DOCUMENT);
      expect(r.clerk).toBe("signed-out");
      expect(r.location).toBeNull();
    }
    expect((await run("/draft?demo", DOCUMENT)).rewrite).toBe(`${ORIGIN}/draft?demo=1`);
  });

  test("the router's request from a browser whose token hasn't been refreshed yet gets a 204, not a cached sign-in", async () => {
    const expired = `__client_uat=${now() - 200}; __session=${await sessionToken(120)}`;
    for (const cookie of [HINT, expired]) {
      for (const path of ["/draft", "/account", "/account?add"]) {
        const r = await run(path, ROUTER, cookie);
        expect(r.status).toBe(204);
        expect(r.location).toBeNull();
      }
    }
  });

  test("a signed-out browser's router request still goes to sign-in", async () => {
    for (const cookie of ["", "__client_uat=0"]) {
      const r = await run("/account", ROUTER, cookie);
      expect(r.status).toBe(307);
      expect(r.location).toStartWith(`${ORIGIN}/sign-in?redirect_url=`);
    }
  });

  test("a server action is never answered with the router's 204", async () => {
    const r = await run("/account", { ...ROUTER, "Next-Action": "abc", Accept: "text/x-component" }, HINT, "POST");
    expect(r.status).not.toBe(204);
  });
});
