/**
 * Whether this browser holds a signed-in Clerk session, read off the one
 * cookie Clerk keeps for exactly that question, without verifying anything.
 *
 * `__client_uat` (and its per-instance twin `__client_uat_<suffix>`) is the
 * second the browser's Clerk client last changed while it had a signed-in
 * session, and "0" once it has none. In production only Clerk's Frontend API
 * writes it (clerk-js 6.39 sets it from JS on development instances alone), as
 * a Set-Cookie on courtvision.dev: sign-in sets it, and sign-out's
 * `removeSessions` call sets it to 0 before clerk-js navigates anywhere, so
 * every tab sees the change at once. It only goes stale when a session ends
 * while no clerk-js is running (it expired, or was revoked), and the Frontend
 * API's first reply to the next page that runs clerk-js puts it back to 0
 * (clerk.courtvision.dev, 2026-10-13: a client read with no session set both
 * names to 0).
 *
 * Clerk's own handshake starts from the same cookie: a non-zero value with no
 * fresh session token is what sends a document request through it.
 */
export function hasSessionHint(cookies: Iterable<{ name: string; value: string }>): boolean {
  for (const { name, value } of cookies) {
    if (name !== "__client_uat" && !name.startsWith("__client_uat_")) continue;
    // Clerk's backend reads it the same way: parseInt, anything else is 0.
    if ((Number.parseInt(value, 10) || 0) > 0) return true;
  }
  return false;
}

/**
 * Whether a request is the client router's: a prefetch, or a navigation or
 * refresh inside an open page, not a document load. Next strips its own
 * prefetch headers (`RSC`, `Next-Router-Prefetch`) before the proxy runs, but
 * keeps `Next-Url`, which the router sends on every one of these and Clerk
 * reads for the same question. GET only: a server action carries it too.
 */
export function isRouterRequest(req: { method: string; headers: Headers }): boolean {
  return req.method === "GET" && req.headers.has("next-url");
}
