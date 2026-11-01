/**
 * The header the app map's crawl puts on every request it lets through to the
 * API. The API refuses any write that carries it, whoever is signed in
 * (APP_MAP_CRAWL_HEADER in core/clerk_auth.py), so the account the crawl signs
 * in as writes when a person or autopilot uses it, and never from the crawl.
 * It only takes rights away, so it holds no secret.
 */
export const CRAWL_HEADER = "x-app-map-crawl";

/**
 * The headers to send a request on with: `headers` plus the crawl's mark when
 * the request goes to the API at `api` (its base URL), or undefined to send it
 * as it is.
 */
export function markedForApi(url: string, headers: Record<string, string>, api: string): Record<string, string> | undefined {
  if (new URL(url).origin !== new URL(api).origin) return undefined;
  return { ...headers, [CRAWL_HEADER]: "1" };
}
