/**
 * Streamer search types — shims over the generated OpenAPI schemas
 * (`bun run generate:api`). The search is scoped to a saved team
 * (`POST /teams/{id}/streamers/find`): the league and its credentials come
 * from the team, so the request body carries only the search options.
 *
 * `StreamerPlayer.player_id` is the ESPN id (the id the roster transaction
 * takes); `nba_player_id` is for headshots and terminal panels.
 */
import type { components } from "./generated/api";
import type { BreakoutCandidateResp } from "./breakout";

type S = components["schemas"];

export type StreamerMode = S["StreamerMode"];

/** Options for the search; every field is optional and defaults server-side. */
export type StreamerFindRequest = S["StreamerFindReq"];

/**
 * A streaming candidate. `acquisition_status` is null when the provider did
 * not say (Yahoo); `waivers_until` is the ISO date a waiver claim clears.
 */
export type StreamerPlayer = S["StreamerPlayerResp"] & {
  // Attached client-side when player matches a breakout candidate
  breakout_context?: BreakoutCandidateResp;
};

/**
 * The search result. `upcoming` is true before opening night, when the
 * server resolves to matchup 1, day 0 and the whole week ahead.
 */
export type StreamerData = S["StreamerData"];

export type StreamerResponse = S["StreamerResp"];
