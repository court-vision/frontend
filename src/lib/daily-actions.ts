/**
 * Today's moves on the Week desk: row order, which rows stage lineup moves and
 * which stage an add, whether a row is staged, the one button each row gets,
 * and how a row reads on the strip. The server writes the
 * row copy; this file decides what the buttons do. Pure.
 */
import { IR_SLOT_ID, stageMoves, unstageMoves, validateStaged, type Staged } from "./lineup-editor";
import type { LineupState, MoveError } from "@/types/lineup-editor";
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

/** A row that stages an add (and maybe a drop) into the desk's tray. */
export function isTransactionAction(a: DailyAction): boolean {
  return (a.kind === "add" || a.kind === "add_drop") && !!a.transaction;
}

/**
 * A lineup row is staged when its subject sits on its target. Subject-only on
 * purpose: when a start row benches X and the IR row sends X to IR, both rows
 * report staged; `stageRow` and `unstageRow` keep a press on either from
 * undoing the other.
 */
export function isRowStaged(staged: Staged, a: DailyAction): boolean {
  const first = movesOf(a)[0];
  return !!first && staged[first.player_id] === first.to_slot_id;
}

/**
 * An add row is staged when its free agent waits in the tray with the same
 * drop, made now — or, after today's first tip (`nowFrom`), as the pickup
 * scheduled for tomorrow that an add made now becomes.
 */
export function isAddStaged(
  a: DailyAction,
  pinned: { faId: number; replaces: number; from: number | null } | null,
  noDrop: number,
  nowFrom: number | null = null
): boolean {
  const t = a.transaction;
  if (!t || !pinned || pinned.from !== nowFrom) return false;
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

/**
 * Stage one lineup row. Its subject always lands; another player it moves
 * stays put when he's staged on IR, so a start pressed after the IR row
 * doesn't pull the OUT starter back to the bench (he's out of the slot
 * either way).
 */
export function stageRow(board: LineupState, staged: Staged, a: DailyAction): Staged {
  return stageMoves(board, staged, movesOf(a).filter((m, i) => i === 0 || staged[m.player_id] !== IR_SLOT_ID));
}

/**
 * Take one lineup row back: only the players still where it put them, then
 * whoever that took off another staged row goes back where that row puts
 * him. Taking back the start row leaves the IR row's player on IR; taking
 * back the IR row benches him, as the start row still staged says.
 */
export function unstageRow(board: LineupState, staged: Staged, a: DailyAction, rows: readonly DailyAction[]): Staged {
  let next = unstageMoves(board, staged, movesOf(a).filter((m) => staged[m.player_id] === m.to_slot_id));
  const others = rows.filter((r) => r.id !== a.id && isLineupAction(r) && isRowStaged(next, r));
  for (const r of stageAllOrder(others)) {
    next = stageMoves(board, next, movesOf(r).filter((m) => m.player_id in staged && !(m.player_id in next)));
  }
  return next;
}

const problemKey = (e: MoveError) => `${e.code}:${e.player_id}:${e.message}`;

/**
 * What "stage all" stages of `actions` (the unstaged lineup rows): each in
 * `stageAllOrder`, kept only when it adds no problem the staging didn't
 * already have. The server judges every row against the current board, so a
 * player off IR and a start can both claim the same open slot; the later one
 * keeps its own Stage button. `rows` are the ones that landed.
 */
export function stageAllFold(
  board: LineupState,
  staged: Staged,
  actions: readonly DailyAction[]
): { staged: Staged; rows: DailyAction[] } {
  let next = staged;
  let known = new Set(validateStaged(board, next).map(problemKey));
  const rows: DailyAction[] = [];
  for (const a of stageAllOrder(actions)) {
    const tried = stageRow(board, next, a);
    const problems = validateStaged(board, tried).map(problemKey);
    if (problems.some((k) => !known.has(k))) continue;
    next = tried;
    known = new Set(problems);
    rows.push(a);
  }
  return { staged: next, rows };
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
// The strip's line
// ---------------------------------------------------------------------------

const SUFFIXES = new Set(["JR", "JR.", "SR", "SR.", "II", "III", "IV", "V"]);

/** "Jaren Jackson Jr." → "Jackson": a surname for the strip, suffixes dropped. */
export function surname(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  while (parts.length > 1 && SUFFIXES.has(parts[parts.length - 1].toUpperCase())) parts.pop();
  return parts.length > 1 ? parts.slice(1).join(" ") : parts[0] ?? "";
}

/** The longest a line gets: the strip shares the tape with the week's numbers. */
export const LINE_MAX = 20;

/** How a row reads on the strip: a verb and surnames. */
export function moveLine(a: DailyAction): string {
  const who = surname(a.player.name);
  switch (a.kind) {
    case "start":
      return `Start ${who}`;
    case "ir_in":
      return `${who} to IR`;
    case "ir_out":
      return `${who} off IR`;
    case "add":
      return `Add ${who}`;
    case "add_drop": {
      // "Thompson for Murray" when it fits the strip; the pickup alone when it doesn't.
      const swap = a.counterpart ? `${who} for ${surname(a.counterpart.name)}` : "";
      return swap && [...swap].length <= LINE_MAX ? swap : `Add ${who}`;
    }
  }
}
