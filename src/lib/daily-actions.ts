/**
 * Pure logic for the Daily Actions widget: row order, which rows stage into
 * the lineup editor, whether a row is already staged, the button each row
 * gets, and the two board-level checks. The server writes the row copy; this
 * file only decides what the buttons do.
 */
import type { Staged } from "./lineup-editor";
import { writeBlockedCopy } from "@/types/lineup-editor";
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

const NO_TIP = "99:99";

/** Kind order, then tip-off (unknown last), then name — the server's own order, so idempotent. */
export function sortActions(actions: readonly DailyAction[]): DailyAction[] {
  return [...actions].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      (a.game_time_et ?? NO_TIP).localeCompare(b.game_time_et ?? NO_TIP) ||
      a.player.name.localeCompare(b.player.name)
  );
}

export function movesOf(a: DailyAction) {
  return a.moves ?? [];
}

/** A row that stages lineup moves (start / IR) and is not blocked. */
export function isLineupAction(a: DailyAction): boolean {
  return (
    (a.kind === "start" || a.kind === "ir_in" || a.kind === "ir_out") &&
    movesOf(a).length > 0 &&
    !a.blocked_reason
  );
}

/** A row that opens the add/drop dialog. */
export function isTransactionAction(a: DailyAction): boolean {
  return (a.kind === "add" || a.kind === "add_drop") && !!a.transaction;
}

/**
 * Staged means the row's subject sits on its target. Subject-only on purpose:
 * when a fill row benches X and the IR row sends X to IR, both rows report
 * staged, and a second tap on either never silently undoes the other.
 */
export function isRowStaged(staged: Staged, a: DailyAction): boolean {
  const first = movesOf(a)[0];
  return !!first && staged[first.player_id] === first.to_slot_id;
}

export function unstagedLineupActions(actions: readonly DailyAction[], staged: Staged): DailyAction[] {
  return actions.filter((a) => isLineupAction(a) && !isRowStaged(staged, a));
}

export const ROW_BLOCKED_COPY: Record<DailyActionBlockedReason, string> = {
  roster_full: "Roster full — drop a player first",
};

export function rowBlockedCopy(a: DailyAction): string | null {
  if (!a.blocked_reason) return null;
  return ROW_BLOCKED_COPY[a.blocked_reason] ?? "Not available right now";
}

export type RowIntent = "stage" | "unstage" | "transaction" | "drop" | "none";

export interface RowButton {
  label: string;
  intent: RowIntent;
  disabled: boolean;
  /** Why the button is disabled, for a hint; null when it is live. */
  reason: string | null;
}

/**
 * The one button a row gets. Lineup rows toggle between Stage and Undo; add
 * rows open the dialog; a blocked IR-out row offers the drop-only dialog. A
 * read-only board disables everything with the board's own reason.
 */
export function rowButton(
  a: DailyAction,
  opts: { staged: boolean; canWrite: boolean; blockedReason?: string | null }
): RowButton {
  const readOnly = opts.canWrite ? null : writeBlockedCopy(opts.blockedReason);
  if (a.blocked_reason) {
    return {
      label: a.kind === "ir_out" ? "Drop a player…" : "Blocked",
      intent: a.kind === "ir_out" ? "drop" : "none",
      disabled: !opts.canWrite || a.kind !== "ir_out",
      reason: readOnly ?? rowBlockedCopy(a),
    };
  }
  if (isTransactionAction(a)) {
    return {
      label: a.kind === "add" ? "Pick up" : "Add / drop",
      intent: "transaction",
      disabled: !opts.canWrite,
      reason: readOnly,
    };
  }
  if (isLineupAction(a)) {
    if (opts.staged) return { label: "Undo", intent: "unstage", disabled: false, reason: null };
    return { label: "Stage", intent: "stage", disabled: !opts.canWrite, reason: readOnly };
  }
  return { label: "—", intent: "none", disabled: true, reason: null };
}

/** The editor's board moved on since the rows were computed (a refetch is due). */
export function boardMismatch(
  data: Pick<DailyActionsData, "roster_version">,
  state: Pick<LineupState, "roster_version"> | null | undefined
): boolean {
  return !!state && !!data.roster_version && state.roster_version !== data.roster_version;
}

const SILENT_STREAMER_ERRORS = new Set(["day_mismatch", "value_kind_mismatch"]);

/** A muted hint when the free-agent search genuinely failed; the day/scale guards stay silent. */
export function streamersHint(data: Pick<DailyActionsData, "streamers_error">): string | null {
  const err = data.streamers_error;
  if (!err || SILENT_STREAMER_ERRORS.has(err)) return null;
  return "Free agents unavailable";
}

/** The drop the server suggested today, for the drop-only dialog's default. */
export function suggestedDropId(actions: readonly DailyAction[]): number | undefined {
  const row = actions.find((a) => a.kind === "add_drop");
  return row?.transaction?.drop_player_id ?? undefined;
}
