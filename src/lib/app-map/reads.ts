/**
 * The API's reads that go as a POST (a search whose options are in the body),
 * which the app map's crawl lets through for its signed-in account. Each
 * stores nothing. The backend's read-only guard for that account
 * (APP_MAP_READS in core/clerk_auth.py) lets exactly these through too and is
 * the wall; this list only keeps the crawl from sending anything else.
 */
const READS_SENT_AS_POST = [
  // The Week desk's market: free agents ranked for a pickup
  /^\/v1\/internal\/teams\/\d+\/streamers\/find$/,
  // A stream lane's dry run: what a lane started now would do
  /^\/v1\/internal\/teams\/\d+\/stream-lanes\/plan$/,
];

/** Whether a request is one of those reads, sent to the API at `api` (its base URL). */
export function isReadSentAsPost(url: string, method: string, api: string): boolean {
  if (method.toUpperCase() !== "POST") return false;
  const u = new URL(url);
  return u.origin === new URL(api).origin && READS_SENT_AS_POST.some((r) => r.test(u.pathname));
}
