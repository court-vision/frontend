/**
 * Pure logic for adding a streamer to an ESPN roster: whether the board has a
 * seat, who could be dropped, why an add is refused before it is even offered,
 * the request body, and the copy for the outcome. The server stays
 * authoritative (`backend/services/roster_transactions`); this gives instant
 * feedback and keeps the dialog free of rules.
 *
 * Ids are ESPN's throughout — `StreamerPlayer.player_id` and
 * `LineupPlayer.player_id` share that id space, and it is what the
 * transaction takes.
 */
import {
  ROSTER_TRANSACTION_INVALID,
  ROSTER_WRITE_REJECTED,
  dataNumber,
  dataString,
  toApiError,
  userMessage,
} from "./api-error";
import { SLOT_ORDER, formatNbaDate } from "./lineup-editor";
import { writeBlockedCopy, type LineupPlayer, type LineupState } from "@/types/lineup-editor";
import type {
  RosterTransactionData,
  RosterTransactionRequest,
  TransactionInvalidReason,
} from "@/types/roster-transaction";
import type { StreamerData, StreamerMode, StreamerPlayer } from "@/types/streamer";
import type { FantasyProvider } from "@/types/team";

// ---------------------------------------------------------------------------
// Capacity
// ---------------------------------------------------------------------------

/**
 * Seats on the roster: the sum of `slot_counts` (IR included — ESPN counts an
 * IR player against nothing else, so a full IR seat is still a seat). Falls
 * back to the slot definitions when the id-keyed map is empty.
 */
export function rosterCapacity(state: LineupState): number {
  const counts = Object.values(state.slot_counts ?? {});
  if (counts.length > 0) {
    return counts.reduce((sum, n) => sum + Math.max(0, n), 0);
  }
  return state.slots.reduce((sum, s) => sum + Math.max(0, s.count), 0);
}

/** True when a pickup needs no drop: the board has an empty seat. */
export function canAddWithoutDrop(state: LineupState): boolean {
  return state.players.length < rosterCapacity(state);
}

// ---------------------------------------------------------------------------
// Drop candidates
// ---------------------------------------------------------------------------

export interface DropCandidate {
  player: LineupPlayer;
  /** ESPN will refuse the drop: his game has started, or ESPN locked the lineup. */
  locked: boolean;
}

/**
 * Everyone on the board as a drop option, in `SLOT_ORDER` (starters PG → UT,
 * then the bench, then IR; a player in a slot outside that order — ESPN's
 * 14/15 — sinks to the end). Board order is kept within a slot. Locked
 * players stay in the list so the reason they can't be dropped is visible.
 */
export function dropCandidates(state: LineupState): DropCandidate[] {
  const rank = (slotId: number) => {
    const i = SLOT_ORDER.indexOf(slotId);
    return i === -1 ? SLOT_ORDER.length : i;
  };
  return state.players
    .map((player, index) => ({ player, index }))
    .sort((a, b) => rank(a.player.lineup_slot_id) - rank(b.player.lineup_slot_id) || a.index - b.index)
    .map(({ player }) => ({ player, locked: player.locked }));
}

// ---------------------------------------------------------------------------
// Waivers
// ---------------------------------------------------------------------------

/** " · clears Tue, Oct 20" when the clearing date is known, else "". */
export function waiversClearsSuffix(until: string | null | undefined): string {
  const date = formatNbaDate(until);
  return date ? ` · clears ${date}` : "";
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

export interface AddBlockedInput {
  player: Pick<StreamerPlayer, "acquisition_status" | "waivers_until">;
  /** Today's board; null/undefined while it is still loading. */
  state: LineupState | null | undefined;
  provider: FantasyProvider | null | undefined;
}

/**
 * Why this streamer cannot be added right now, as a sentence for the disabled
 * control — or null when the add may be offered. A board that has not loaded
 * is not a reason (the dialog shows its own loading state); a board that is
 * read-only is, with the same copy the lineup editor's banner uses.
 */
export function addBlockedReason({ player, state, provider }: AddBlockedInput): string | null {
  if (provider !== "espn") return "Adding players is available for ESPN teams";
  if (player.acquisition_status === "waivers") {
    return `On waivers — claim him on ESPN${waiversClearsSuffix(player.waivers_until)}`;
  }
  if (state && !state.can_write) return writeBlockedCopy(state.write_blocked_reason);
  return null;
}

/**
 * Why nobody can be dropped right now — the same gates as an add minus the
 * waivers one, which is about the incoming player. Null when a drop may be
 * offered.
 */
export function dropBlockedReason({ state, provider }: Pick<AddBlockedInput, "state" | "provider">): string | null {
  if (provider !== "espn") return "Dropping players is available for ESPN teams";
  if (state && !state.can_write) return writeBlockedCopy(state.write_blocked_reason);
  return null;
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export interface TransactionBodyInput {
  /** The streamer to add, or null for a straight drop. */
  player: Pick<StreamerPlayer, "player_id"> | null;
  /** ESPN id of the player to release, or null for a straight add. */
  dropId: number | null;
  state: LineupState;
}

/**
 * The request for "add this streamer, dropping `dropId` if given" — or, with
 * no streamer, "drop `dropId`" — pinned to the board the user saw
 * (`roster_version`, `scoring_period_id`) so a board that moved on ESPN
 * answers ROSTER_STALE. Null when there is nothing to send (neither side) or
 * the board has no scoring period: there is nothing to pin to, and such a
 * board is read-only anyway (`write_blocked_reason: no_scoring_period`).
 */
export function transactionBody({
  player,
  dropId,
  state,
}: TransactionBodyInput): RosterTransactionRequest | null {
  if (state.scoring_period_id == null) return null;
  if (player === null && dropId === null) return null;
  return {
    add_player_id: player?.player_id ?? null,
    drop_player_id: dropId ?? null,
    expected_scoring_period_id: state.scoring_period_id,
    roster_version: state.roster_version,
  };
}

// ---------------------------------------------------------------------------
// Outcome
// ---------------------------------------------------------------------------

export interface TransactionOutcomeCopy {
  tone: "success" | "warning";
  message: string;
}

/**
 * The toast for a 200: what happened on ESPN, built from `added`/`dropped`
 * (either may be absent). A write ESPN accepted but the re-read could not
 * confirm is a warning, not a success.
 */
export function transactionOutcomeCopy(
  data: Pick<RosterTransactionData, "added" | "dropped" | "verified">
): TransactionOutcomeCopy {
  if (!data.verified) {
    return { tone: "warning", message: "Sent to ESPN — not confirmed yet, check your roster" };
  }
  const parts: string[] = [];
  if (data.added) parts.push(`Added ${data.added.name}`);
  if (data.dropped) parts.push(`${data.added ? "dropped" : "Dropped"} ${data.dropped.name}`);
  const what = parts.length ? parts.join(" · ") : "Roster updated";
  return { tone: "success", message: `${what} on ESPN` };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export interface TransactionError {
  /** Set on a 422 ROSTER_TRANSACTION_INVALID; null when ESPN itself refused (409). */
  reason: TransactionInvalidReason | null;
  /** The player the refusal is about, when the server named one. */
  playerId: number | null;
  message: string;
}

/**
 * The refusals the dialog renders inline: a 422 the server explained
 * (`data.reason`, a user sentence in `message`) or a 409 ESPN rejected with
 * its own sentence. Null for everything else — those are toasts.
 */
export function transactionError(error: unknown): TransactionError | null {
  if (error == null) return null;
  const err = toApiError(error);
  if (err.code === ROSTER_TRANSACTION_INVALID) {
    return {
      reason: (dataString(err, "reason") as TransactionInvalidReason | null) ?? null,
      playerId: dataNumber(err, "player_id"),
      message: userMessage(err),
    };
  }
  if (err.code === ROSTER_WRITE_REJECTED) {
    return { reason: null, playerId: null, message: userMessage(err) };
  }
  return null;
}

/**
 * Refusals that mean the streamer list is out of date — the player is no
 * longer a free agent, or never was one — so the list should refresh.
 */
export const STALE_POOL_REASONS: ReadonlySet<TransactionInvalidReason> = new Set<TransactionInvalidReason>([
  "add_on_waivers",
  "add_not_available",
  "add_not_found",
]);

// ---------------------------------------------------------------------------
// Captions
// ---------------------------------------------------------------------------

/**
 * The info bar's first line. Before opening night the search is for week 1
 * and "Day 1 Pickup" would be misleading — the picks are for the whole week
 * (or its first day) once it starts, so the caption says when that is.
 */
export function streamerCaption(
  data: Pick<
    StreamerData,
    "matchup_number" | "current_day_index" | "target_day" | "game_span" | "start_date" | "upcoming"
  >,
  mode: StreamerMode
): string {
  const matchup = `Matchup ${data.matchup_number}`;
  if (data.upcoming) {
    const starts = formatNbaDate(data.start_date);
    const when = starts ? ` · starts ${starts}` : "";
    return `${matchup}${when}${mode === "week" ? " · full week" : ""}`;
  }
  if (mode === "daily") {
    return `${matchup} · Day ${(data.target_day ?? data.current_day_index) + 1} Pickup`;
  }
  return `${matchup} · Day ${data.current_day_index + 1} of ${data.game_span}`;
}
