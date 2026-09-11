/**
 * ESPN's espn_s2 / SWID cookies: reading them out of what a user pastes, and
 * the bookmarklet that copies them from a logged-in ESPN tab.
 */

/** Drag-to-bookmarks helper: run on espn.com, it offers both cookies to copy. */
export const ESPN_COOKIE_BOOKMARKLET = `javascript:(function(){const s2=document.cookie.match(/espn_s2=([^;]+)/);const swid=document.cookie.match(/SWID=([^;]+)/);if(s2&&swid){prompt('Copy these values:','espn_s2='+decodeURIComponent(s2[1])+'; SWID='+decodeURIComponent(swid[1]));}else{alert('Please log into ESPN first.');}})()`;

export interface EspnCookies {
  s2: string;
  swid: string;
}

/**
 * Both cookies from a pasted string — the bookmarklet's output or a raw
 * `document.cookie` — or null unless both are there.
 *
 * The SWID is URL-decoded: `document.cookie` holds it as `%7B…%7D`, and the
 * backend's normalization strips braces but cannot decode, so an encoded SWID
 * would key a second connection for the same account. espn_s2 is left exactly
 * as pasted.
 */
export function parseCookieString(input: string): EspnCookies | null {
  const s2 = input.match(/espn_s2=([^;]+)/)?.[1].trim();
  const swid = input.match(/SWID=([^;]+)/)?.[1].trim();
  if (!s2 || !swid) return null;
  return { s2, swid: decodeSwid(swid) };
}

/** A SWID with its percent-encoding undone (`%7B…%7D` → `{…}`); kept as is when malformed. */
export function decodeSwid(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
