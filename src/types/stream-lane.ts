/**
 * Stream lanes (`/teams/{id}/stream-lanes`) — shims over the generated OpenAPI
 * schemas (`bun run generate:api`).
 *
 * A lane is a standing order to keep one roster spot streaming for the rest of
 * the matchup. Before each day the server re-plans the spot with the players
 * available then and, when the plan switches, makes the pickup. What the desk
 * shows is a projection as of one moment; it can change.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type StreamLane = S["StreamLane"];
export type StreamLaneEvent = S["StreamLaneEvent"];
export type StreamLaneList = S["StreamLaneListData"];
export type StreamLanePlan = S["StreamLanePlan"];
export type LanePlayer = S["LanePlayer"];
export type LaneProjection = S["LaneProjection"];
export type LaneProjectionDay = S["LaneProjectionDay"];
export type StreamLaneStartRequest = S["StreamLaneStartReq"];
export type StreamLaneUpdateRequest = S["StreamLaneUpdateReq"];
export type StreamLaneResponse = S["StreamLaneResp"];
export type StreamLaneListResponse = S["StreamLaneListResp"];
export type StreamLanePlanResponse = S["StreamLanePlanResp"];
export type LaneNotify = StreamLane["notify"];
export type LaneStatus = StreamLane["status"];

/**
 * `data.reason` on a 422 STREAM_LANE_INVALID: the board, the league or the
 * calendar refused the lane. The envelope `message` is already a user sentence.
 */
export type LaneInvalidReason =
  | "not_on_roster"
  | "on_ir"
  | "scheduled_out"
  | "no_matchup_end"
  | "matchup_over"
  | "waiver_period_unsupported"
  | "no_scoring_period"
  | "holder_gone";
