/**
 * The AI desk's chips: moves the agent proposed (`propose_move`, `propose_lineup`)
 * and the server checked, shown in the thread as `proposal` blocks. A chip is
 * staged into the Week desk's tray (its `Tray` + `SlideToSend`, rendered in the
 * AI desk) and sent by the slider through the same writes the Week desk makes,
 * with `proposal_id` on the request so the server marks the chip sent. Nothing
 * here executes anything; these are the pure pieces the hook and the components
 * share.
 *
 * The tray shows one add / drop per day column (`TrayDay.swap`), as in the Week
 * desk, plus any drops made on their own (`TrayDay.drops`, today's column only:
 * a drop alone can't be scheduled), and a lineup chip's slot moves
 * (`TrayDay.moves`, one lineup chip per day: it is one write of that day's
 * board). A chip replaces what it can't be sent beside: the day's other add,
 * any chip dropping (or adding) a player it drops (or adds), and the day's
 * other lineup chip, since the first write would make the second impossible.
 * The replaced chip stays proposed in the thread.
 */
import type { TrayDay, TrayMove } from "@/components/week/Tray";
import { monthDay, signed } from "@/components/week/format";
import { diff, type Staged } from "@/lib/lineup-editor";
import type { AiProposalChip, AiProposalMove, AiProposalState } from "@/types/ai";
import type { LineupMove, LineupState } from "@/types/lineup-editor";

/** A chip in the tray, with what the server's check said and how its last send went. */
export interface StagedChip {
  chip: AiProposalChip;
  /** Why it can't be sent as it stands (the server's check); [] when it can. */
  problems: string[];
  /** Why its last send failed; null until one does. */
  error: string | null;
  /** The check hasn't answered yet. */
  checking: boolean;
}

/** What the desk learned about a chip since the turn stored it: sent or dismissed here, before the server's copy arrives. */
export type ChipPatch = Pick<AiProposalChip, "state" | "sent_at">;

export const CHECKING = "Checking the move…";

/** Why a chip that isn't proposed can't be staged or sent, in the server's words. */
export const STATE_WORDS: Record<Exclude<AiProposalState, "proposed">, string> = {
  sent: "This move was already sent.",
  dismissed: "This chip was dismissed.",
  expired: "This chip expired: the day it was for has started.",
};

/** The chip's state as of `now`: a proposed chip past its expiry reads as expired, whatever the stored copy says. */
export function chipState(chip: Pick<AiProposalChip, "state" | "expires_at">, now: number = Date.now()): AiProposalState {
  if (chip.state === "proposed" && new Date(chip.expires_at).getTime() <= now) return "expired";
  return chip.state;
}

/** A chip with what the desk knows since it was stored, if anything. */
export function patchChip<T extends Pick<AiProposalChip, "proposal_id">>(chip: T, patches: ReadonlyMap<number, ChipPatch>): T {
  const patch = patches.get(chip.proposal_id);
  return patch ? { ...chip, ...patch } : chip;
}

/** Why `chip` can't go into the tray right now; null when it can. The tray holds one team's moves at a time. */
export function stageProblem(chip: AiProposalChip, staged: readonly StagedChip[], now: number = Date.now()): string | null {
  const state = chipState(chip, now);
  if (state !== "proposed") return STATE_WORDS[state];
  const other = staged.find((x) => x.chip.team_id !== chip.team_id);
  if (other) return "The tray holds one team's moves at a time; send or discard what's in it first.";
  return null;
}

/**
 * `staged` with `chip` in it, awaiting its check. A chip already there is
 * re-staged; a chip the new one can't be sent beside (`conflicts`) leaves.
 */
export function withStaged(staged: readonly StagedChip[], chip: AiProposalChip): StagedChip[] {
  const kept = staged.filter((x) => x.chip.proposal_id !== chip.proposal_id && !conflicts(x.chip, chip));
  return [...kept, { chip, problems: [], error: null, checking: true }];
}

/**
 * Two chips that can't both be sent: two adds in one column (one add / drop per
 * day), one player dropped by both or added by both, or two lineup chips for
 * one day (each is one write of that day's whole board: the first would leave
 * the second's slots stale or its slot counts over) — whichever write went
 * first would make the other fail. Adding a player one day and dropping him on
 * a later one is a stream, not a conflict; a lineup chip goes first in its day,
 * so a drop beside it in the same column is fine.
 */
function conflicts(a: AiProposalChip, b: AiProposalChip): boolean {
  return (
    (a.add != null && b.add != null && a.day === b.day) ||
    (a.drop != null && a.drop.espn_id === b.drop?.espn_id) ||
    (a.add != null && a.add.espn_id === b.add?.espn_id) ||
    (a.kind === "lineup" && b.kind === "lineup" && a.day === b.day)
  );
}

export function withoutStaged(staged: readonly StagedChip[], proposalId: number): StagedChip[] {
  return staged.filter((x) => x.chip.proposal_id !== proposalId);
}

/** "2026-10-22" → "Thursday" (the date alone, no time zone). */
export function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

/** When the chip's move is made, for its column: scheduled ones say so, today's (and lineups) are made on send. */
export function timingOf(chip: Pick<AiProposalChip, "kind" | "date">): string | null {
  return chip.kind === "scheduled" ? `Made for you before ${weekdayOf(chip.date)}'s games` : null;
}

/** A lineup chip's slot moves as the tray lists them (ESPN ids, as the board keys players). */
export function movesOf(chip: Pick<AiProposalChip, "moves">): TrayMove[] {
  return chip.moves.map((m) => ({ playerId: m.espn_id, name: m.name, from: m.from_slot_id, to: m.to_slot_id, role: m.role }));
}

/**
 * A lineup chip's moves to send against `board` as it is now, as the Week desk
 * sends what it has staged (`diff`): each player from the slot this board has
 * him in, less the moves the board already shows. The chip proposes where each
 * player goes; where he starts from is the board's, and an earlier day's write
 * carries forward on ESPN (an edit there moves players too), so the chip's
 * stored slots can be behind it. The server checks the moves it gets are the
 * chip's (player and slot) before the write. `gone` names a player the chip
 * moves who has left the roster: then the chip can't be sent as it shows.
 */
export function liveMoves(chip: Pick<AiProposalChip, "moves">, board: LineupState): { moves: LineupMove[]; gone: AiProposalMove | null } {
  const gone = chip.moves.find((m) => !board.players.some((p) => p.player_id === m.espn_id)) ?? null;
  const staged: Staged = Object.fromEntries(chip.moves.map((m) => [m.espn_id, m.to_slot_id]));
  return { moves: gone ? [] : diff(board, staged), gone };
}

/** The projected change, in the league's terms: "+4.5" for points, "+1 cat" for categories; null when the server had none. */
export function changeLabel(chip: Pick<AiProposalChip, "change" | "scoring">): string | null {
  if (chip.change == null) return null;
  if (chip.scoring === "categories") {
    const n = Math.round(chip.change);
    const sign = n > 0 ? "+" : n < 0 ? "−" : "";
    return `${sign}${Math.abs(n)} cat${Math.abs(n) === 1 ? "" : "s"}`;
  }
  return signed(chip.change);
}

/**
 * The tray's columns from the staged chips: one per day, in day order. An add
 * (with or without a drop) is the column's `swap`, made now in today's column
 * or scheduled for its day; a drop on its own is one of the column's `drops`;
 * a lineup chip's slot moves are the column's `moves`. A chip that stopped
 * being proposed, is still being checked, or failed its check holds its column
 * back through `problems`.
 */
export function trayDaysOf(staged: readonly StagedChip[], now: number = Date.now()): TrayDay[] {
  const columns = new Map<number, TrayDay>();
  for (const item of staged) {
    const c = item.chip;
    const col: TrayDay = columns.get(c.day) ?? {
      day: c.day,
      dow: c.dow,
      date: monthDay(c.date),
      moves: [],
      drops: [],
      swap: null,
      delta: 0,
      problems: [],
      error: null,
    };
    const state = chipState(c, now);
    const problems = [
      ...(state !== "proposed" ? [STATE_WORDS[state]] : []),
      ...(item.checking ? [CHECKING] : []),
      ...item.problems,
    ];
    if (c.kind === "lineup") {
      col.moves = [...col.moves, ...movesOf(c)];
    } else if (c.add) {
      col.swap = {
        add: { id: c.add.espn_id, name: c.add.name, team: c.add.team ?? "", games: c.add.team ?? "" },
        drop: c.drop ? { id: c.drop.espn_id, name: c.drop.name } : null,
        from: c.kind === "scheduled" ? c.day : null,
        timings: [],
        timing: timingOf(c),
      };
    } else if (c.drop) {
      col.drops = [...col.drops, { id: c.drop.espn_id, name: c.drop.name }];
    }
    col.delta += c.change ?? 0;
    col.problems = [...col.problems, ...problems];
    col.error = col.error ?? item.error;
    columns.set(c.day, col);
  }
  return [...columns.values()].sort((a, b) => a.day - b.day);
}

/**
 * The chips a day sends, in order: the lineup first (one write of the day's
 * board, pinned to it as it stands), then drops on their own (each its own
 * transaction), then the add / drop.
 */
export function sendOrder(staged: readonly StagedChip[], day: number): StagedChip[] {
  const mine = staged.filter((x) => x.chip.day === day);
  const lineups = mine.filter((x) => x.chip.kind === "lineup");
  const rest = mine.filter((x) => x.chip.kind !== "lineup");
  return [...lineups, ...rest.filter((x) => !x.chip.add), ...rest.filter((x) => !!x.chip.add)];
}

/** The staged lineup chip in `day`'s column that moves ESPN player `playerId`, if any. */
export function lineupChipOf(staged: readonly StagedChip[], day: number, playerId: number): StagedChip | undefined {
  return staged.find((x) => x.chip.kind === "lineup" && x.chip.day === day && x.chip.moves.some((m) => m.espn_id === playerId));
}

/** The staged chip whose column `day` shows as its add / drop, if any. */
export function swapChipOf(staged: readonly StagedChip[], day: number): StagedChip | undefined {
  return staged.find((x) => x.chip.day === day && !!x.chip.add);
}

/** The staged drop-on-its-own chip for ESPN player `playerId`, if any. */
export function dropChipOf(staged: readonly StagedChip[], playerId: number): StagedChip | undefined {
  return staged.find((x) => !x.chip.add && x.chip.drop?.espn_id === playerId);
}
