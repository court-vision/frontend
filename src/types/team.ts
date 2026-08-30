/**
 * Team & league types — generated from the backend's OpenAPI schema.
 *
 * Shim over `src/types/generated/api.ts`; regenerate with `bun run
 * generate:api`.
 *
 * Credentials are structurally absent on the read side (`LeagueInfoPublic`)
 * and structurally unrepresentable on the write side (`LeagueInfoWrite` —
 * the backend model cannot carry a raw Yahoo token, so neither can this
 * file, however it is regenerated).
 */
import type { components } from "./generated/api";

type S = components["schemas"];

// Fantasy provider type
export type FantasyProvider = S["FantasyProvider"];

/** Per-team override of the rendered scoring format (e.g. view a points league as 9-cat). */
export type ScoringPreview = "points" | "categories";

/**
 * What the API returns about a stored team (backend `LeagueInfoPublic`).
 *
 * Credentials are deliberately absent — the server never sends ESPN cookies or
 * Yahoo tokens to the browser. `has_*_credentials` says whether they are on
 * file so the UI can show "stored"; to change them, send new values in a
 * `LeagueInfoRequest`. Sending none leaves the stored ones untouched.
 */
export type LeagueInfo = S["LeagueInfoPublic"];

export type { ScoringType, CategoryDef, CategoryWinMode } from "./scoring";

// Provider-detected league settings (backend LeagueSummary)
export type LeagueSummary = S["LeagueSummary"];

// Full league detail (backend LeagueDetail, GET /teams/{id}/league)
export type LeagueDetail = S["LeagueDetail"];

// Team response from backend (backend TeamResponse)
export type TeamResponseData = S["TeamResponse"];

// Legacy interface for backwards compatibility
export interface TeamInfo {
  team_name: string;
  league_name: string;
  league_id: number;
  year: number;
  espn_s2?: string;
  swid?: string;
}

export interface Team {
  team_id: number;
  team_info: TeamInfo;
}

export type RosterPlayer = S["PlayerResp"];

/** What the client sends (backend `LeagueInfoWrite`). Credentials are
 *  optional: omit them to keep the stored ones (the server merges), supply
 *  them to replace. Yahoo tokens cannot be represented here — the browser
 *  holds an opaque `yahoo_connection_id`, never the tokens. */
export type LeagueInfoRequest = S["LeagueInfoWrite"];

// Backend API Response Types
export type TeamGetResponse = S["TeamGetResp"];
export type TeamAddResponse = S["TeamAddResp"];
export type TeamRemoveResponse = S["TeamRemoveResp"];
export type TeamUpdateResponse = S["TeamUpdateResp"];
export type LeagueGetResponse = S["LeagueGetResp"];
export type LeagueSyncResponse = S["LeagueSyncResp"];
