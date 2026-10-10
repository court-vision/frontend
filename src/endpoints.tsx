export const PROD_BACKEND_ENDPOINT = "https://api.courtvision.dev";

// Set NEXT_PUBLIC_API_BASE (e.g. http://127.0.0.1:8000) to target a local backend
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || PROD_BACKEND_ENDPOINT;

if (process.env.NODE_ENV === "development" && !process.env.NEXT_PUBLIC_API_BASE) {
  console.warn(
    `NEXT_PUBLIC_API_BASE is unset — API calls target production (${PROD_BACKEND_ENDPOINT}).`
  );
}

// API v1 Internal endpoints
export const TEAMS_API = `${API_BASE}/v1/internal/teams`;
export const MATCHUPS_API = `${API_BASE}/v1/internal/matchups`;
export const STREAMERS_API = `${API_BASE}/v1/internal/streamers`;
export const YAHOO_API = `${API_BASE}/v1/internal/yahoo`;
// Provider connections: an ESPN account's cookies, stored once for every team on it
export const CONNECTIONS_API = `${API_BASE}/v1/internal/connections`;
export const NOTIFICATIONS_API = `${API_BASE}/v1/internal/notifications`;
export const API_KEYS_API = `${API_BASE}/v1/internal/api-keys`;
// Draft Lab: sessions, picks, and the board scored for either.
export const DRAFTS_API = `${API_BASE}/v1/internal/drafts`;
export const SQLMATE_INTERNAL_API = `${API_BASE}/v1/internal/sqlmate`;

// The Draft Tap extension. Live ESPN draft sync connects to it; unset means the
// feature is off and the room stays fully manual.
// Comma-separated: the Chrome Web Store id first (the install link points at
// it), then any others to try, such as the id an unpacked development copy has.
export const DRAFT_TAP_EXTENSION_IDS = (process.env.NEXT_PUBLIC_DRAFT_TAP_EXTENSION_ID || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

/** The Draft Tap's Chrome Web Store listing, or null when no id is configured. */
export const DRAFT_TAP_STORE_URL = DRAFT_TAP_EXTENSION_IDS[0]
  ? `https://chromewebstore.google.com/detail/${DRAFT_TAP_EXTENSION_IDS[0]}`
  : null;

// API v1 Public endpoints
export const LIVE_API = `${API_BASE}/v1/live`;
export const RANKINGS_API = `${API_BASE}/v1/rankings`;
export const PLAYERS_API = `${API_BASE}/v1/players`;
export const GAMES_API = `${API_BASE}/v1/games`;
export const OWNERSHIP_API = `${API_BASE}/v1/ownership`;
export const SCHEDULE_API = `${API_BASE}/v1/schedule`;
export const SQLMATE_API = `${API_BASE}/v1/sqlmate`;
