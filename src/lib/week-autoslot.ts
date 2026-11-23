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
import { BENCH_SLOT_ID, assignment, diff, isActiveSlot, normalize, unstage, type Staged } from "./lineup-editor";
import { isOutStatus } from "./week-grid";
import type { LineupMove, LineupPlayer, LineupState } from "@/types/lineup-editor";

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

/**
 * Start bench players in the active spots `staged` leaves open on a day, ones
 * without a game too: it changes no score, and a lineup with no OPEN spot
 * reads better than one with six on the bench (James, 2026-11-23). Only `idle`
 * players go in (no game that day, or out), so nobody who would score is
 * moved. Everyone already in an active spot stays in one, shifting only when
 * that opens a spot someone can take (a free spot he fits is used first); the
 * healthy go in before the out, then the higher average. Locked players and
 * IR never move. Returns the staging with the fills added.
 */
export function fillOpenSpots(board: LineupState, staged: Staged, idle: (p: LineupPlayer) => boolean): Staged {
  const seat = assignment(board, staged);
  const room = new Map<number, number>();
  for (const s of board.slots) if (isActiveSlot(s.slot_id) && s.count > 0) room.set(s.slot_id, s.count);
  const starters: Array<{ id: number; at: number }> = [];
  const fillers: LineupPlayer[] = [];
  const fits = new Map<number, number[]>();
  for (const p of board.players) {
    const at = seat.get(p.player_id) ?? p.lineup_slot_id;
    const fixed = p.locked || p.lineup_locked;
    if (room.has(at) && (fixed || !p.eligible_slot_ids.includes(at))) {
      // He keeps his spot whatever happens: it isn't free.
      room.set(at, room.get(at)! - 1);
      continue;
    }
    if (fixed) continue;
    fits.set(p.player_id, p.eligible_slot_ids.filter((x) => room.has(x)));
    if (room.has(at)) starters.push({ id: p.player_id, at });
    else if (at === BENCH_SLOT_ID && fits.get(p.player_id)!.length > 0 && idle(p)) fillers.push(p);
  }
  // One entry per spot, its holder's id (null: open), starters where they sit.
  const spots: number[] = [];
  for (const [slot, n] of room) for (let k = 0; k < n; k++) spots.push(slot);
  const holder: Array<number | null> = spots.map(() => null);
  for (const st of starters) {
    const i = spots.findIndex((slot, k) => slot === st.at && holder[k] === null);
    if (i < 0) return staged; // more starters than spots: leave the day as it is
    holder[i] = st.id;
  }
  if (!holder.includes(null) || fillers.length === 0) return staged;

  // An augmenting path: the player takes a spot he fits, its holder shifting along to another.
  const seatIn = (id: number, seen: Set<number>): boolean => {
    const options = spots.map((_, i) => i).filter((i) => !seen.has(i) && fits.get(id)!.includes(spots[i]));
    const open = options.find((i) => holder[i] === null);
    if (open != null) {
      holder[open] = id;
      return true;
    }
    for (const i of options) {
      if (seen.has(i)) continue;
      seen.add(i);
      if (seatIn(holder[i]!, seen)) {
        holder[i] = id;
        return true;
      }
    }
    return false;
  };
  const rank = (p: LineupPlayer) => (isOutStatus(p.injury_status) ? 0 : 1) * 1e6 + p.avg_points;
  for (const p of [...fillers].sort((a, b) => rank(b) - rank(a) || a.player_id - b.player_id)) {
    if (!holder.includes(null)) break;
    seatIn(p.player_id, new Set());
  }

  const out: Staged = { ...staged };
  holder.forEach((id, i) => {
    if (id != null) out[id] = spots[i];
  });
  return normalize(board, out);
}
