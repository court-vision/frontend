/**
 * What the Yahoo OAuth callback's `?yahoo_error=` code means to the person
 * reading the toast. The backend sends a short code (it is mid-redirect and
 * never renders a body); anything it does not name here is shown as-is,
 * truncated, so a crafted URL cannot inject a paragraph.
 */
const YAHOO_CONNECT_ERRORS: Record<string, string> = {
  fantasy_not_authorized:
    "Yahoo signed you in, but its Fantasy Sports API refused the app. In the Yahoo developer console the app needs the Fantasy Sports permission (Read) enabled; Yahoo turns it on after the access review.",
  no_account_id:
    "Yahoo did not say which account this is, so nothing was saved. Try connecting again.",
  oauth_failed: "Yahoo did not complete the sign-in. Try connecting again.",
  invalid_state: "This sign-in link expired or was already used. Start the connect again.",
  oauth_storage_unavailable:
    "Court Vision cannot store the Yahoo login right now. Try again in a few minutes.",
};

export const MAX_RAW_ERROR_LENGTH = 100;

export function yahooConnectErrorMessage(code: string): string {
  return YAHOO_CONNECT_ERRORS[code] ?? `Yahoo connection failed: ${code.slice(0, MAX_RAW_ERROR_LENGTH)}`;
}
