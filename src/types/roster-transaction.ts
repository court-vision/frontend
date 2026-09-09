/**
 * Add/drop transaction types (`POST /teams/{id}/roster/transactions`) —
 * shims over the generated OpenAPI schemas (`bun run generate:api`).
 *
 * Player ids are ESPN's, the same id space as `LineupPlayer.player_id` and
 * `StreamerPlayer.player_id`. `roster_version` / `expected_scoring_period_id`
 * come from the board the user was looking at, so a board that moved on ESPN
 * in the meantime answers 409 ROSTER_STALE with the fresh one.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

/** At least one of `add_player_id` / `drop_player_id` must be set. */
export type RosterTransactionRequest = S["RosterTransactionReq"];
export type RosterTransactionData = S["RosterTransactionData"];
export type RosterTransactionPlayer = S["RosterTransactionPlayer"];
export type RosterTransactionResponse = S["RosterTransactionResp"];

/**
 * `data.reason` on a 422 ROSTER_TRANSACTION_INVALID: the board or the player
 * pool refused the request before ESPN was asked. The envelope `message` is
 * already a user sentence; the reason lets the client react (a waivers or
 * availability refusal means the streamer list is out of date).
 */
export type TransactionInvalidReason =
  | "nothing_to_do"
  | "same_player"
  | "drop_not_on_roster"
  | "drop_locked"
  | "add_already_on_roster"
  | "add_not_found"
  | "add_on_waivers"
  | "add_not_available"
  | "add_locked";
