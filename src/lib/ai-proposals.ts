/**
 * The AI desk's chips: moves the agent proposed (`propose_move`) and the server
 * checked, shown in the thread as `proposal` blocks. A chip is staged into the
 * Week desk's tray (its `Tray` + `SlideToSend`, rendered in the AI desk) and
 * sent by the slider through the same writes the Week desk makes, with
 * `proposal_id` on the request so the server marks the chip sent. Nothing here
 * executes anything; these are the pure pieces the hook and the components share.
 *
 * The tray shows one add / drop per day column (`TrayDay.swap`), as in the Week
 * desk, plus any drops made on their own (`TrayDay.drops`, today's column only:
 * a drop alone can't be scheduled). Staging a second add for a day replaces the
 * first; the replaced chip stays proposed in the thread.
 */
import type { TrayDay } from "@/components/week/Tray";
import { monthDay, signed } from "@/components/week/format";
import type { AiProposalChip, AiProposalState } from "@/types/ai";

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
 * re-staged; an add replaces the day's other add (one add / drop per column).
 */
export function withStaged(staged: readonly StagedChip[], chip: AiProposalChip): StagedChip[] {
  const kept = staged.filter(
    (x) => x.chip.proposal_id !== chip.proposal_id && !(chip.add && x.chip.add && x.chip.day === chip.day)
  );
  return [...kept, { chip, problems: [], error: null, checking: true }];
}

export function withoutStaged(staged: readonly StagedChip[], proposalId: number): StagedChip[] {
  return staged.filter((x) => x.chip.proposal_id !== proposalId);
}

/** "2026-10-22" → "Thursday" (the date alone, no time zone). */
export function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

/** When the chip's move is made, for its column: scheduled ones say so, today's are made on send. */
export function timingOf(chip: Pick<AiProposalChip, "kind" | "date">): string | null {
  return chip.kind === "scheduled" ? `Made for you before ${weekdayOf(chip.date)}'s games` : null;
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
 * or scheduled for its day; a drop on its own is one of the column's `drops`.
 * A chip that stopped being proposed, is still being checked, or failed its
 * check holds its column back through `problems`.
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
    if (c.add) {
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

/** The chips a day sends, in order: drops on their own first (each its own transaction), then the add / drop. */
export function sendOrder(staged: readonly StagedChip[], day: number): StagedChip[] {
  const mine = staged.filter((x) => x.chip.day === day);
  return [...mine.filter((x) => !x.chip.add), ...mine.filter((x) => !!x.chip.add)];
}

/** The staged chip whose column `day` shows as its add / drop, if any. */
export function swapChipOf(staged: readonly StagedChip[], day: number): StagedChip | undefined {
  return staged.find((x) => x.chip.day === day && !!x.chip.add);
}

/** The staged drop-on-its-own chip for ESPN player `playerId`, if any. */
export function dropChipOf(staged: readonly StagedChip[], playerId: number): StagedChip | undefined {
  return staged.find((x) => !x.chip.add && x.chip.drop?.espn_id === playerId);
}
