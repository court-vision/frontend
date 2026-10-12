/**
 * Today's moves on the Week desk: row order, which rows stage lineup moves and
 * which stage an add, whether a row is staged, the one button each row gets,
 * and how a row reads on the strip's split-flap board. The server writes the
 * row copy; this file decides what the buttons do. Pure.
 */
import type { Staged } from "./lineup-editor";
import type { LineupState } from "@/types/lineup-editor";
import type {
  DailyAction,
  DailyActionBlockedReason,
  DailyActionKind,
  DailyActionsData,
} from "@/types/daily-actions";

export const KIND_ORDER: Record<DailyActionKind, number> = {
  ir_out: 0,
  ir_in: 1,
  start: 2,
  add_drop: 3,
  add: 3,
};

/** The short word for a row's kind (the box's tag column). */
export const KIND_WORD: Record<DailyActionKind, string> = {
  start: "START",
  ir_in: "TO IR",
  ir_out: "OFF IR",
  add: "ADD",
  add_drop: "SWAP",
};

const NO_TIP = "99:99";

/** Kind order, then tip-off (unknown last), then name: the server's own order, so idempotent. */
export function sortActions(actions: readonly DailyAction[]): DailyAction[] {
  return [...actions].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      (a.game_time_et ?? NO_TIP).localeCompare(b.game_time_et ?? NO_TIP) ||
      a.player.name.localeCompare(b.player.name)
  );
}

function movesOf(a: DailyAction) {
  return a.moves ?? [];
}

/** A row that stages lineup moves (start / IR) and is not blocked. */
export function isLineupAction(a: DailyAction): boolean {
  return (a.kind === "start" || a.kind === "ir_in" || a.kind === "ir_out") && movesOf(a).length > 0 && !a.blocked_reason;
}

/** A row that stages an add (and maybe a drop) into the desk's dock. */
export function isTransactionAction(a: DailyAction): boolean {
  return (a.kind === "add" || a.kind === "add_drop") && !!a.transaction;
}

/**
 * A lineup row is staged when its subject sits on its target. Subject-only on
 * purpose: when a start row benches X and the IR row sends X to IR, both rows
 * report staged, and a second press on either never silently undoes the other.
 */
export function isRowStaged(staged: Staged, a: DailyAction): boolean {
  const first = movesOf(a)[0];
  return !!first && staged[first.player_id] === first.to_slot_id;
}

/** An add row is staged when its free agent waits in the dock with the same drop, made now. */
export function isAddStaged(
  a: DailyAction,
  pinned: { faId: number; replaces: number; from: number | null } | null,
  noDrop: number
): boolean {
  const t = a.transaction;
  if (!t || !pinned || pinned.from != null) return false;
  return pinned.faId === t.pickup.player_id && pinned.replaces === (t.drop_player_id ?? noDrop);
}

export function unstagedLineupActions(actions: readonly DailyAction[], staged: Staged): DailyAction[] {
  return actions.filter((a) => isLineupAction(a) && !isRowStaged(staged, a));
}

/**
 * The order "stage all" applies lineup rows in: starts first, then IR. A
 * start that benches an OUT player and the IR row that sends him to IR both
 * land (the IR row's move is the later one, so it wins).
 */
const STAGE_ALL_ORDER: Record<DailyActionKind, number> = { start: 0, ir_in: 1, ir_out: 2, add: 3, add_drop: 3 };

export function stageAllOrder(actions: readonly DailyAction[]): DailyAction[] {
  return [...actions].sort((a, b) => STAGE_ALL_ORDER[a.kind] - STAGE_ALL_ORDER[b.kind]);
}

export const ROW_BLOCKED_COPY: Record<DailyActionBlockedReason, string> = {
  roster_full: "Roster full: drop a player first",
};

export function rowBlockedCopy(a: DailyAction): string | null {
  if (!a.blocked_reason) return null;
  return ROW_BLOCKED_COPY[a.blocked_reason] ?? "Not available right now";
}

export type RowIntent = "stage" | "unstage" | "none";

export interface RowButton {
  label: "Stage" | "Staged" | "Blocked";
  intent: RowIntent;
  disabled: boolean;
  /** Why the button can't stage, for a hint; null when it can. */
  reason: string | null;
}

/**
 * The one button a row gets: Stage, or Staged (pressed again, it unstages).
 * Staging never sends anything: lineup moves wait in the tray, an add in the
 * dock. `cannot` is why the desk can't stage right now (no today on the grid,
 * rows computed against an older board).
 */
export function rowButton(a: DailyAction, opts: { staged: boolean; cannot: string | null }): RowButton {
  if (a.blocked_reason) return { label: "Blocked", intent: "none", disabled: true, reason: rowBlockedCopy(a) };
  if (!isLineupAction(a) && !isTransactionAction(a)) return { label: "Blocked", intent: "none", disabled: true, reason: null };
  if (opts.staged) return { label: "Staged", intent: "unstage", disabled: false, reason: null };
  return { label: "Stage", intent: "stage", disabled: opts.cannot != null, reason: opts.cannot };
}

/** The desk's board moved on since the rows were computed (another roster, or another day): a refetch is due. */
export function boardMismatch(
  data: Pick<DailyActionsData, "roster_version" | "scoring_period_id">,
  board: Pick<LineupState, "roster_version" | "scoring_period_id"> | null | undefined
): boolean {
  if (!board) return false;
  if (data.scoring_period_id != null && board.scoring_period_id != null && data.scoring_period_id !== board.scoring_period_id) return true;
  return !!data.roster_version && board.roster_version !== data.roster_version;
}

const SILENT_STREAMER_ERRORS = new Set(["day_mismatch", "value_kind_mismatch"]);

/** A muted hint when the free-agent search genuinely failed; the day/scale guards stay silent. */
export function streamersHint(data: Pick<DailyActionsData, "streamers_error">): string | null {
  const err = data.streamers_error;
  if (!err || SILENT_STREAMER_ERRORS.has(err)) return null;
  return "Free agents unavailable: no pickup today";
}

// ---------------------------------------------------------------------------
// The split-flap line
// ---------------------------------------------------------------------------

const SUFFIXES = new Set(["JR", "JR.", "SR", "SR.", "II", "III", "IV", "V"]);

/** "Jaren Jackson Jr." → "JACKSON": a surname for the board, suffixes dropped. */
export function surname(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  while (parts.length > 1 && SUFFIXES.has(parts[parts.length - 1].toUpperCase())) parts.pop();
  return (parts.length > 1 ? parts.slice(1).join(" ") : parts[0] ?? "").toUpperCase();
}

/** The most cells the board ever has: it shares the tape with the week's numbers. */
export const FLAP_MAX = 20;

/** How a row reads on the board: a verb and surnames, upper case. */
export function flapText(a: DailyAction): string {
  const who = surname(a.player.name);
  switch (a.kind) {
    case "start":
      return `START ${who}`;
    case "ir_in":
      return `${who} TO IR`;
    case "ir_out":
      return `${who} OFF IR`;
    case "add":
      return `ADD ${who}`;
    case "add_drop": {
      // "THOMPSON FOR MURRAY" when it fits the board; the pickup alone when it doesn't.
      const swap = a.counterpart ? `${who} FOR ${surname(a.counterpart.name)}` : "";
      return swap && [...swap].length <= FLAP_MAX ? swap : `ADD ${who}`;
    }
  }
}

/** Cells on the board: the longest line, within bounds, so short days don't sprawl and long ones don't scroll. */
export function flapWidth(lines: readonly string[], min: number = 12, max: number = FLAP_MAX): number {
  const longest = lines.reduce((n, l) => Math.max(n, [...l].length), 0);
  return Math.min(max, Math.max(min, longest));
}

/** A line padded with blank flaps, or cut with an ellipsis, to exactly `width` cells. */
export function fitFlap(line: string, width: number): string[] {
  const chars = [...line];
  if (chars.length > width) return [...chars.slice(0, width - 1), "…"];
  return [...chars, ...Array.from({ length: width - chars.length }, () => " ")];
}

/** The order a flap's drum turns through: what a real board shows between two letters. */
export const FLAP_DRUM = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·-";

/**
 * The faces a flap shows going from `from` to `to`: up to `extra` faces after
 * `from` on the drum (stopping early at `to`), then `to`. Nothing when they're
 * the same. A face off the drum (Ş, Ć) starts from the blank.
 */
export function flapSteps(from: string, to: string, extra: number = 2): string[] {
  if (from === to) return [];
  const at = FLAP_DRUM.indexOf(from);
  const out: string[] = [];
  for (let i = 1; i <= extra; i++) {
    const face = FLAP_DRUM[(Math.max(at, 0) + i) % FLAP_DRUM.length];
    if (face === to) break;
    out.push(face);
  }
  out.push(to);
  return out;
}
