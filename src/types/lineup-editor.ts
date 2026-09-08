/**
 * Manual lineup editor + "Optimize today" types — shims over the generated
 * OpenAPI schemas (`bun run generate:api`), plus the user-facing copy for the
 * reasons a board is read-only.
 *
 * Slot ids are ESPN's: 0 PG, 1 SG, 2 SF, 3 PF, 4 C, 5 G, 6 F, 7 SG/SF,
 * 8 G/F, 9 PF/C, 10 F/C, 11 UT, 12 BE, 13 IR; 14/15 are never editable.
 * `LineupPlayer.player_id` is the ESPN id (same id space as the matchup and
 * roster responses); `nba_player_id` is for headshots and terminal panels.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type LineupState = S["LineupState"];
export type LineupPlayer = S["LineupPlayer"];
export type LineupSlotDef = S["LineupSlotDef"];

/** One slot change: `from_slot_id` is the slot the board showed, `to_slot_id` the target. */
export type LineupMove = S["LineupMoveReq"];
export type ApplyLineupMovesRequest = S["ApplyLineupMovesReq"];
export type ApplyLineupMovesData = S["ApplyLineupMovesData"];
export type ApplyLineupMovesResponse = S["ApplyLineupMovesResp"];

export type LineupPlanData = S["LineupPlanData"];
export type LineupPlanResponse = S["LineupPlanResp"];
export type LineupStateResponse = S["LineupStateResp"];
export type LineupMoveResult = S["LineupMoveResult"];
export type LineupUnfilled = S["LineupUnfilled"];

/**
 * One reason a set of moves cannot be sent (backend `MoveErrorResp`). It only
 * ever travels inside a 422's `data.errors`, so the OpenAPI snapshot has no
 * schema for it; the shape mirrors `backend/schemas/lineup_editor.py`.
 * `player_id` is null for slot-level errors (CAPACITY).
 */
export interface MoveError {
  player_id: number | null;
  code: MoveErrorCode | string;
  message: string;
}

export type MoveErrorCode =
  | "UNKNOWN_PLAYER"
  | "DUPLICATE_PLAYER"
  | "SAME_SLOT"
  | "STALE_SLOT"
  | "LOCKED"
  | "UNTOUCHABLE_SLOT"
  | "INELIGIBLE"
  | "CAPACITY";

export type WriteBlockedReason = NonNullable<LineupState["write_blocked_reason"]>;

/** Why the board is read-only, as a sentence the banner can show. */
export const WRITE_BLOCKED_COPY: Record<WriteBlockedReason, string> = {
  writes_disabled: "Lineup changes from Court Vision are switched off right now.",
  no_credentials: "Add your ESPN cookies in Manage Teams to edit your lineup here.",
  not_team_owner: "The stored ESPN login doesn't own this team.",
  no_scoring_period: "ESPN hasn't opened today's lineup yet.",
  provider_not_supported: "Lineup editing is available for ESPN teams.",
  team_id_unresolved:
    "Couldn't match this team on ESPN — check the team name in Manage Teams.",
};

export function writeBlockedCopy(reason: string | null | undefined): string {
  return (
    (reason && WRITE_BLOCKED_COPY[reason as WriteBlockedReason]) ||
    "Lineup changes aren't available for this team right now."
  );
}
