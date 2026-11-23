/**
 * Autoslot across the days left in the matchup week, and the lineup ESPN will
 * hold for each day when the tray's send gets to it.
 *
 * ESPN keeps one lineup per day, and an edit carries into the days after it
 * until one has its own edit. The tray sends days earliest first, so a later
 * day is written onto whatever an earlier day's write carried into it: when
 * Monday's write starts a player who has no game on Tuesday, Tuesday has him
 * started too until Tuesday's own write moves him back.
 *
 * A day autoslot fills is "held": its lineup is the plan, whatever an earlier
 * day carries in. Its staging is kept as a slot for every player (not only the
 * ones that differ from the board), so the send works out its moves against
 * the lineup it finds that day, and a held day whose plan is the lineup ESPN
 * already has for it is still written when an earlier day's edit would carry
 * over it. Days nobody held keep carrying, as on ESPN.
 *
 * Whether an edit will reach a day is read the way the week grid reads it: a
 * day whose lineup matches the day before's (players staged to drop aside) has
 * no edit of its own yet.
 */
import { assignment, diff, normalize, unstage, type Staged } from "./lineup-editor";
import type { LineupMove, LineupState } from "@/types/lineup-editor";

/** Where everyone sits on a day: ESPN player id → slot id. */
export type Lineup = Map<number, number>;

export interface CarryInput {
  /** Each day's board as the desk holds it (by day index), with players staged to drop already gone. */
  boards: ReadonlyArray<LineupState | null | undefined>;
  /** Each day's staging, by day index. */
  stagedByDay: Readonly<Record<number, Staged>>;
  /** Days whose staging is their whole lineup (autoslot planned them). */
  held: ReadonlySet<number>;
  /** A day already played: nothing is sent there, and nothing carries out of it. */
  played: (day: number) => boolean;
  /** Players staged to drop, each gone from a day index on. */
  leaves?: ReadonlyArray<{ id: number; from: number }>;
}

/** `staged` as a slot for every player on `board`: the whole lineup it makes. */
export function wholeLineup(board: LineupState, staged: Staged): Staged {
  return Object.fromEntries(assignment(board, staged));
}

/** `board` with everyone where `lineup` puts them (a player it doesn't name stays put). */
export function withLineup(board: LineupState, lineup: Lineup | null | undefined): LineupState {
  if (!lineup) return board;
  let changed = false;
  const players = board.players.map((p) => {
    const slot = lineup.get(p.player_id);
    if (slot == null || slot === p.lineup_slot_id) return p;
    changed = true;
    return { ...p, lineup_slot_id: slot };
  });
  return changed ? { ...board, players } : board;
}

function sameLineup(a: Lineup, b: Lineup): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

/**
 * Per day, the lineup ESPN will hold for it just before the send writes it,
 * when every staged day goes: the lineup an earlier day's write carries in, or
 * its own when it has an edit of its own (or nothing earlier is written).
 * Null for a day already played or not read.
 */
export function lineupsBeforeSend(input: CarryInput): Array<Lineup | null> {
  const { boards, stagedByDay, held, played, leaves = [] } = input;
  const lessGone = (m: Lineup, day: number): Lineup => {
    const gone = leaves.filter((x) => day >= x.from && m.has(x.id));
    if (gone.length === 0) return m;
    const out = new Map(m);
    for (const x of gone) out.delete(x.id);
    return out;
  };
  const out: Array<Lineup | null> = [];
  let prevRaw: Lineup | null = null;
  let prevAfter: Lineup | null = null;
  boards.forEach((b, day) => {
    if (!b || played(day)) {
      out.push(null);
      return;
    }
    const raw = assignment(b, {});
    const carried = prevRaw && prevAfter && sameLineup(raw, lessGone(prevRaw, day)) ? lessGone(prevAfter, day) : null;
    const before = carried ?? raw;
    out.push(before);
    const staged = normalize(b, stagedByDay[day] ?? {});
    // A held day ends as planned. Any other staged day's send moves only the players it names,
    // from wherever the lineup carried in has them.
    let after: Lineup;
    if (held.has(day)) after = assignment(b, staged);
    else {
      after = new Map(before);
      for (const [id, slot] of Object.entries(staged)) if (after.has(Number(id))) after.set(Number(id), slot);
    }
    prevRaw = raw;
    prevAfter = after;
  });
  return out;
}

/**
 * A held day's moves as the send will make them: from the lineup carried in
 * (`before`) to the plan (its board with its staging).
 */
export function heldMoves(board: LineupState, before: Lineup | null | undefined, staged: Staged): LineupMove[] {
  return diff(withLineup(board, before), wholeLineup(board, staged));
}

/**
 * Take one of a held day's moves back, as the tray lists them: the player (and
 * the one he swaps with) stays where the lineup carried in has him. Returns the
 * day's whole lineup again.
 */
export function unstageHeld(board: LineupState, before: Lineup | null | undefined, staged: Staged, playerId: number): Staged {
  const from = withLineup(board, before);
  const onFrom = normalize(from, wholeLineup(board, staged));
  return wholeLineup(from, unstage(from, onFrom, playerId));
}

/**
 * Plan `days` (in day order) with `plan`, each on the lineup it will have once
 * the days before it are sent, and hold them. `plan` gets that lineup as a
 * board and returns the day's staging on it, or null to leave the day as it is.
 * Returns the new staging and held days, and the days whose staged moves changed.
 */
export function planDays(
  input: CarryInput,
  days: readonly number[],
  plan: (day: number, board: LineupState) => Staged | null
): { stagedByDay: Record<number, Staged>; held: Set<number>; changed: number[] } {
  const stagedByDay: Record<number, Staged> = { ...input.stagedByDay };
  const held = new Set(input.held);
  const changed: number[] = [];
  for (const day of [...days].sort((a, b) => a - b)) {
    const b = input.boards[day];
    if (!b || input.played(day)) continue;
    const before = lineupsBeforeSend({ ...input, stagedByDay, held })[day];
    const from = withLineup(b, before);
    const staged = plan(day, from);
    if (!staged) continue;
    const whole = wholeLineup(from, staged);
    const hadMoves = Object.keys(normalize(b, stagedByDay[day] ?? {})).length > 0;
    if (diff(from, whole).length === 0 && Object.keys(normalize(b, whole)).length === 0) {
      // The plan is the lineup ESPN has for the day and nothing carries over it: nothing to stage.
      held.delete(day);
      delete stagedByDay[day];
      if (hadMoves) changed.push(day);
      continue;
    }
    stagedByDay[day] = whole;
    held.add(day);
    if (hadMoves || diff(from, whole).length > 0) changed.push(day);
  }
  return { stagedByDay, held, changed };
}
