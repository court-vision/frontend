/**
 * Scheduled pickups (`/teams/{id}/pickups`) — shims over the generated OpenAPI
 * schemas (`bun run generate:api`).
 *
 * A pickup names a free agent to add (ESPN id), optionally the player to drop,
 * and the ESPN day it is for. The server makes it at the earliest moment it
 * counts for that day: the day before's first tip-off, or the rollover into the
 * day when the player to drop plays the day before. A player gone by then makes
 * it a no-op.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type SchedulePickupRequest = S["SchedulePickupReq"];
export type ScheduledPickup = S["ScheduledPickup"];
export type ScheduledPickupPlayer = S["ScheduledPickupPlayer"];
export type ScheduledPickupList = S["ScheduledPickupListData"];
export type ScheduledPickupResponse = S["ScheduledPickupResp"];
export type ScheduledPickupListResponse = S["ScheduledPickupListResp"];
export type PickupStatus = ScheduledPickup["status"];

/**
 * `data.reason` on a 422 SCHEDULED_PICKUP_INVALID: the board or the pool
 * refused the pickup before it was stored. The envelope `message` is already a
 * user sentence.
 */
export type PickupInvalidReason =
  | "not_future"
  | "no_scoring_period"
  | "same_player"
  | "add_already_on_roster"
  | "add_not_found"
  | "add_not_available"
  | "drop_not_on_roster";
