/**
 * The week grid: one row per rostered player, one column per day of the
 * matchup period, and the totals that fall out of it.
 *
 * Everything here is pure. `WeekSource` is the normalized input (see
 * `week-source.ts` for the API adapter and the demo for a hand-built one);
 * `buildWeekGrid` turns it, today's ESPN board and the staging into rows,
 * day totals and the headline numbers.
 *
 * How a day decides who counts:
 *   past    — the lineup as it stood (`pastLineups`, the API's nightly record),
 *             read-only: only the active spots count, and the day total is the
 *             API's. A day with no record shows today's spots and counts every
 *             played game, as the API's total for it does;
 *   today   — the ESPN board with the staged moves applied;
 *   future  — `mode: "espn"` (the default): the same board, because ESPN carries
 *             a lineup forward until it is changed, so a benched player's games
 *             don't count; `mode: "best"`: the best lineup for that day
 *             (`planDay`), every healthy player with a game slotted to maximize
 *             projected points, and anyone left over "sits".
 *   Without a board (Yahoo) every day uses the best lineup.
 */
import type { LineupState } from "@/types/lineup-editor";
import {
  BENCH_SLOT_ID,
  IR_SLOT_ID,
  assignment as boardAssignment,
  SLOT_ORDER,
  isActiveSlot,
  normalize,
  slotName,
  slotRows,
  type Staged,
} from "./lineup-editor";

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

export type DayKind = "past" | "today" | "future";

export interface WeekDay {
  index: number;
  /** YYYY-MM-DD */
  date: string;
  /** "Tue" */
  dow: string;
  kind: DayKind;
}

export type GameStatus = "scheduled" | "live" | "final";

/** One game's box score (final or so far). */
export interface StatLine {
  min: number | null;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  ftm: number;
  fta: number;
  fg3m: number;
}

export interface DayGame {
  /** "@ LAL" / "vs HOU", when known. */
  opp: string | null;
  /** "19:30" ET, when known. */
  time: string | null;
  status: GameStatus;
  /** Final or in-progress fantasy points; null before tip (or no box score). */
  fpts: number | null;
  /** In progress: "Q3 4:12". */
  clock: string | null;
  /** Share of the game still to play: 1 before tip, 0 at the final. */
  remaining: number;
  /** Ruled out for this game. */
  out: boolean;
  /** The box score so far, when the game has one. */
  line?: StatLine | null;
}

export interface SourcePlayer {
  id: number;
  name: string;
  team: string;
  nbaId: number | null;
  /** Projected points per game. */
  avg: number;
  injury: string | null;
  /** Active slot ids he may fill. Used when there is no ESPN board. */
  eligible: number[];
  /** One entry per day index; null = no game. */
  games: Array<DayGame | null>;
}

export interface SourceOpponent {
  id: number;
  name: string;
  avg: number;
  /** In an active slot on the opponent's board today. */
  active: boolean;
  games: Array<DayGame | null>;
  team?: string;
  nbaId?: number | null;
  /** Today's lineup slot ("PG", "UT", "BE", "IR"); the API keeps no other day's. */
  slot?: string;
  injury?: string | null;
}

/** A scoring category, as the matchup reports it. */
export interface MatchupCategory {
  key: string;
  label: string;
  higherIsBetter: boolean;
  isRate: boolean;
}

export interface WeekSource {
  period: number;
  days: WeekDay[];
  /** Index of today in `days`, or null outside the period. */
  todayIndex: number | null;
  you: { name: string; current: number | null };
  opp: { name: string; current: number | null };
  mine: SourcePlayer[];
  opponents: SourceOpponent[];
  /**
   * The API's day totals for finished days: the active spots' points on a day
   * whose lineup is on record, every rostered player's points on one without.
   */
  pastTotals: { you: Array<number | null>; opp: Array<number | null> };
  /**
   * Each finished day's lineup as it stood, per side (player id → ESPN slot
   * id), by day index: the nightly snapshot or ESPN's own history. Null for a
   * day with no record (today's roster stands in) and for today and later.
   */
  pastLineups?: { you: Array<ReadonlyMap<number, number> | null>; opp: Array<ReadonlyMap<number, number> | null> };
  /**
   * Players on a finished day's lineup who have left the roster since, per
   * side: they show on that day and nowhere else. Never in `mine` or
   * `opponents`, which are the rosters as they stand now.
   */
  gone?: { mine: SourcePlayer[]; opp: SourceOpponent[] };
  /** Active lineup spots, for teams with no ESPN board. */
  activeSlotCount: number;
  /** How the league scores; points when unknown. */
  format?: "points" | "categories";
  /** The league's categories (category leagues). */
  categories?: MatchupCategory[];
  /** The week so far per category, as the API scores it (live-adjusted when it can be). */
  weekCategories?: Array<{ key: string; you: number; opp: number }> | null;
}

/** A free agent previewed in place of a rostered player. */
export interface Incoming {
  player: SourcePlayer;
  /** The rostered player he would replace. */
  replaces: number;
  /**
   * The first day the swap applies, for a pickup scheduled ahead: before it the
   * replaced player keeps his spot and the free agent isn't on the roster.
   * Omitted: an add made now, the replaced player gone from today.
   */
  from?: number;
  /**
   * The day he leaves again (exclusive), for one stretch of a stream lane's
   * projection: another free agent takes the spot then. Omitted: he stays.
   */
  until?: number;
}

/**
 * A previewed add, or a stream lane's chain of them: free agents holding one
 * rostered player's spot on stretches of days. Every stretch replaces the same
 * player, and no two overlap.
 */
export type IncomingPreview = Incoming | readonly Incoming[];

// ---------------------------------------------------------------------------
// Planning a day
// ---------------------------------------------------------------------------

export interface PlanSlot {
  slotId: number;
  count: number;
}

export interface PlanCandidate {
  id: number;
  avg: number;
  eligible: readonly number[];
}

/**
 * The best lineup for one day: candidate id → active slot id. Greedy by
 * projected points with an augmenting path for each candidate, which is
 * optimal here (the sets of players that can all be seated form a matroid).
 * Specific slots are tried before flexible ones, so a center lands at C
 * rather than UT when both are open.
 */
export function planDay(cands: readonly PlanCandidate[], slots: readonly PlanSlot[]): Map<number, number> {
  const instances: number[] = [];
  for (const s of [...slots].sort((a, b) => a.slotId - b.slotId)) {
    for (let k = 0; k < s.count; k++) instances.push(s.slotId);
  }
  const sorted = [...cands].sort((a, b) => b.avg - a.avg || a.id - b.id);
  const owner: Array<number | null> = instances.map(() => null);

  const augment = (ci: number, seen: Set<number>): boolean => {
    const c = sorted[ci];
    for (let i = 0; i < instances.length; i++) {
      if (seen.has(i) || !c.eligible.includes(instances[i])) continue;
      seen.add(i);
      const held = owner[i];
      if (held === null || augment(held, seen)) {
        owner[i] = ci;
        return true;
      }
    }
    return false;
  };
  sorted.forEach((_, ci) => augment(ci, new Set()));

  const out = new Map<number, number>();
  owner.forEach((ci, i) => {
    if (ci !== null) out.set(sorted[ci].id, instances[i]);
  });
  return out;
}

/** The league's active slots (PG … UT), or `count` UT spots without a board. */
export function activeSlots(state: LineupState | null | undefined, count: number): PlanSlot[] {
  if (!state) return [{ slotId: 11, count }];
  return state.slots
    .filter((s) => isActiveSlot(s.slot_id) && s.count > 0)
    .map((s) => ({ slotId: s.slot_id, count: s.count }));
}

/**
 * The active spots finished days' records name (each as often as one day filled
 * it), for when no board says. A spot left empty on every day on record still
 * exists, so UT spots make up any shortfall from `count`.
 */
export function recordedSlots(lineups: ReadonlyArray<ReadonlyMap<number, number> | null>, count: number): PlanSlot[] {
  const most = new Map<number, number>();
  for (const lineup of lineups) {
    const held = new Map<number, number>();
    for (const slot of lineup?.values() ?? []) if (isActiveSlot(slot)) held.set(slot, (held.get(slot) ?? 0) + 1);
    for (const [slot, n] of held) most.set(slot, Math.max(most.get(slot) ?? 0, n));
  }
  if (most.size === 0) return [];
  const short = count - [...most.values()].reduce((a, b) => a + b, 0);
  if (short > 0) most.set(UTIL_SLOT_ID, (most.get(UTIL_SLOT_ID) ?? 0) + short);
  return SLOT_ORDER.filter((id) => most.has(id)).map((slotId) => ({ slotId, count: most.get(slotId)! }));
}

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

export type CellState = "none" | "final" | "live" | "upcoming" | "out" | "dnp";

/** Why a game doesn't count: BENCH (on the ESPN bench), SITS (no room in the best lineup), IR, DROP (preview). */
export type CellTag = "BENCH" | "SITS" | "IR" | "DROP" | null;

export interface GridCell {
  state: CellState;
  /** The box score (final and live games). */
  line?: StatLine | null;
  /** Points (final / live) or the projection (upcoming). */
  value: number | null;
  opp: string | null;
  /** Tip time or game clock. */
  note: string | null;
  counts: boolean;
  tag: CellTag;
}

export type RowKind = "player" | "open" | "incoming";

export interface GridRow {
  key: string;
  kind: RowKind;
  /** Slot on the selected day: "PG", "UT", "BE", "IR", or "IN" for a previewed player who sits. */
  slot: string;
  slotId: number | null;
  player: SourcePlayer | null;
  cells: GridCell[];
  total: number;
  /** Moved by the staging (today) — the slot label shows it. */
  staged: boolean;
  /** Leaving the roster: replaced in the preview, or staged to drop. */
  outgoing: boolean;
  /** Staged to drop (not a previewed add's drop). */
  dropped?: boolean;
  /** Not on the roster on the selected (past) day: added since. */
  later?: boolean;
}

export interface DayTotal {
  /** Points scored so far (today) or the final (past). */
  actual: number | null;
  /** Expected finish for today and future days; the final for past days. */
  projected: number | null;
  starts: number;
}

/** Lineup groups; "drop" holds the players leaving the roster (a previewed add's, staged drops), below everything else. */
export type SeatGroup = "active" | "bench" | "ir" | "drop";

/** One lineup spot: a slot instance (UT has three), a bench spot or an IR spot. */
export interface SlotRowDef {
  key: string;
  slotId: number;
  slot: string;
  group: SeatGroup;
}

export interface Seat {
  player: SourcePlayer;
  cell: GridCell;
  /** Moved by the staging. */
  staged: boolean;
  /** A previewed free agent. */
  incoming: boolean;
  /** Moved to another spot so a previewed free agent fits where he helps most. */
  shifted?: boolean;
  /** Leaving the roster: the player a previewed add drops, or one staged to drop. */
  outgoing?: boolean;
  /** Staged to drop (not a previewed add's drop). */
  dropped?: boolean;
}

/**
 * Every day's lineup, spot by spot: `seats[day][row]` is who sits in
 * `slots[row]` that day. A past day sits as it stood when its lineup is on
 * record, else in today's board's spots (or the first planned day's).
 */
export interface DailyLineups {
  slots: SlotRowDef[];
  seats: Array<Array<Seat | null>>;
  /** ESPN's today, when it falls in this week (day 1 of the season before it starts). */
  boardDay: number | null;
  /** Days whose lineup can be changed: the ones with an ESPN lineup read for them. */
  editable: boolean[];
  /** Past days whose spots are their own (on record), not today's standing in. */
  asItStood: boolean[];
}

export interface WeekGrid {
  days: WeekDay[];
  viewDay: number;
  rows: GridRow[];
  lineups: DailyLineups;
  you: DayTotal[];
  opp: DayTotal[];
  now: { you: number; opp: number };
  projected: { you: number; opp: number };
  startsLeft: { you: number; opp: number };
}

/** How days ahead are lined up: as set on ESPN (carried forward) or the best fit for each day's games. */
export type LineupMode = "espn" | "best";

/** One day's ESPN lineup and the moves staged on it. */
export interface DayBoard {
  board: LineupState;
  staged: Staged;
}

export interface GridInput {
  source: WeekSource;
  /** Today's ESPN board, when the team has one. */
  board: LineupState | null;
  staged: Staged;
  /**
   * Each day's own ESPN lineup (by day index), when it has been read. A day
   * without one carries the day before forward, as ESPN does. Without this,
   * `board` + `staged` stand for the day their `nba_date` names.
   */
  dayBoards?: ReadonlyArray<DayBoard | null | undefined>;
  incoming: IncomingPreview | null;
  /**
   * Players staged to drop, each gone from `from` (a day index) on: his games
   * there stop counting, and he moves to the drop group as a previewed add's
   * dropped player does. `board` and `dayBoards` are the lineups as they stand
   * once he has gone (`withoutDropped` in `drops.ts`).
   */
  dropping?: ReadonlyArray<{ id: number; from: number }>;
  /** The day the roster column describes. */
  viewDay: number;
  /** Default "espn". */
  mode?: LineupMode;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Days the roster column can show: every one, past days read-only. */
export function viewableDays(source: WeekSource): number[] {
  return source.days.map((d) => d.index);
}

/** The roster column's day until one is picked: today (the last day once the period is over, the first before it starts). */
export function defaultViewDay(source: WeekSource): number {
  return source.todayIndex ?? (source.days.length > 0 && source.days.every((d) => d.kind === "past") ? source.days.length - 1 : 0);
}

export function buildWeekGrid({
  source,
  board,
  staged,
  dayBoards: dayBoardsIn,
  incoming,
  dropping,
  viewDay,
  mode = "espn",
}: GridInput): WeekGrid {
  const { days, todayIndex } = source;
  const asSet = mode === "espn" && board != null;
  /** A finished day's lineup as it stood (player id → slot), when the API has it on record. */
  const stoodOn = (day: number): ReadonlyMap<number, number> | null =>
    days[day]?.kind === "past" ? source.pastLineups?.you[day] ?? null : null;
  // Until the board loads (or when it can't), a day on record still names the
  // league's spots, and its starters sit in them rather than vanish.
  const recorded = board ? [] : recordedSlots(days.map((d) => stoodOn(d.index)), source.activeSlotCount);
  const slots = recorded.length ? recorded : activeSlots(board, source.activeSlotCount);
  const boardById = new Map((board?.players ?? []).map((p) => [p.player_id, p]));
  const todayAssign = board ? boardAssignment(board, staged) : null;

  const current = source.mine;
  // Players dropped since a finished day are on that day's lineup, and nowhere else.
  const goneIds = new Set((source.gone?.mine ?? []).map((p) => p.id));
  const roster = goneIds.size ? [...current, ...source.gone!.mine] : current;
  const stretches: readonly Incoming[] = incoming == null ? [] : Array.isArray(incoming) ? incoming : [incoming as Incoming];
  const replaced = stretches[0]?.replaces ?? null;
  // Staged drops on the roster (a previewed add's own drop is his), and the day each is gone from.
  const leaves = new Map(
    (dropping ?? []).filter((x) => x.id !== replaced && roster.some((p) => p.id === x.id)).map((x) => [x.id, x.from])
  );
  const droppedOn = (id: number, day: number) => {
    const from = leaves.get(id);
    return from != null && day >= from;
  };
  /** A day's lineup without the players dropped by then (a day's board already leaves them out). */
  const lessDropped = (m: Map<number, number>, day: number) =>
    leaves.size ? new Map([...m].filter(([id]) => !droppedOn(id, day))) : new Map(m);

  // Each day's ESPN lineup: the ones read for it, else `board` on the day it names.
  const boardDayIndex = board?.nba_date ? days.findIndex((d) => d.date === board.nba_date) : -1;
  const dayBoards: Array<DayBoard | null> = days.map((d) => {
    const own = dayBoardsIn?.[d.index];
    if (own) return own;
    if (board && (d.index === boardDayIndex || (boardDayIndex < 0 && d.index === todayIndex))) return { board, staged };
    return null;
  });
  // The lineup as it will stand each day: its own (with its staged moves); a day
  // with no staging of its own that matches the day before inherits that day's
  // staged moves too (ESPN carries an edit forward); a day not read carries the
  // day before. Past days are unknown.
  const asSetByDay: Array<Map<number, number> | null> = [];
  // What ESPN holds for each day right now (a day not read: the day before's).
  const rawByDay: Array<Map<number, number> | null> = [];
  {
    let prevRaw: Map<number, number> | null = null;
    let prevEff: Map<number, number> | null = null;
    for (const d of days) {
      const db = dayBoards[d.index];
      if (d.kind === "past") {
        asSetByDay.push(null);
        rawByDay.push(null);
        continue;
      }
      if (db) {
        const raw = boardAssignment(db.board, {});
        const ownStaging = Object.keys(normalize(db.board, db.staged)).length > 0;
        const eff: Map<number, number> =
          !ownStaging && prevRaw && prevEff && sameAssignment(raw, lessDropped(prevRaw, d.index))
            ? lessDropped(prevEff, d.index)
            : boardAssignment(db.board, db.staged);
        prevRaw = raw;
        prevEff = eff;
        asSetByDay.push(eff);
        rawByDay.push(raw);
      } else {
        asSetByDay.push(prevEff ? lessDropped(prevEff, d.index) : todayAssign ? lessDropped(todayAssign, d.index) : null);
        rawByDay.push(prevRaw ? lessDropped(prevRaw, d.index) : board ? lessDropped(boardAssignment(board, {}), d.index) : null);
      }
    }
  }
  const viewBoard = dayBoards[viewDay] ?? null;
  /** A pending change on `day`: the player sits somewhere other than where ESPN has him (staged there or carried in). */
  const pendingOn = (day: number, id: number) => {
    const raw = rawByDay[day];
    const eff = asSetByDay[day];
    return !!raw && !!eff && raw.has(id) && raw.get(id) !== eff.get(id);
  };
  // The roster column follows an ESPN lineup on every day it applies to.
  const boardRows = viewBoard != null && (asSet || viewDay === todayIndex);
  const irIds = new Set(
    (board?.players ?? []).filter((p) => p.lineup_slot_id === IR_SLOT_ID).map((p) => p.player_id)
  );

  const eligibleOf = (p: SourcePlayer): number[] => {
    const b = boardById.get(p.id);
    return b ? b.eligible_slot_ids.filter(isActiveSlot) : p.eligible;
  };

  const incomers = [...new Map(stretches.map((x) => [x.player.id, x.player])).values()];
  const pool: SourcePlayer[] = [...roster, ...incomers];
  const inIds = new Set(incomers.map((p) => p.id));
  const rosterOn = (day: number): SourcePlayer[] => {
    const stood = stoodOn(day);
    if (stood) return roster.filter((p) => stood.has(p.id));
    return leaves.size ? current.filter((p) => !droppedOn(p.id, day)) : current;
  };
  // The stretch in force on a day: a scheduled pickup changes the roster from its
  // day on (before it the roster stands); a lane's stretch also ends.
  const inOn = (day: number): Incoming | null =>
    stretches.find((x) => (x.from == null || day >= x.from) && (x.until == null || day < x.until)) ?? null;
  const swapsOn = (day: number) => inOn(day) != null;
  const poolOn = (day: number): SourcePlayer[] => {
    const x = inOn(day);
    return x ? [...rosterOn(day), x.player] : rosterOn(day);
  };
  const replacedOn = (day: number) => (swapsOn(day) ? replaced : null);
  /** Gone from the roster on `day`: staged to drop, or replaced by the previewed add. */
  const leftOn = (id: number, day: number) => droppedOn(id, day) || id === replacedOn(day);
  // Everyone leaving, in the order their drop rows show: the previewed add's, then the staged drops.
  const outgoing = [replaced, ...leaves.keys()]
    .map((id) => (id != null ? roster.find((p) => p.id === id) ?? null : null))
    .filter((p): p is SourcePlayer => p !== null);
  const outIds = new Set(outgoing.map((p) => p.id));
  /** A previewed free agent on a day he isn't on the roster (outside his stretch). */
  const offRoster = (p: SourcePlayer, day: number) => inIds.has(p.id) && inOn(day)?.player.id !== p.id;
  // Today, a player whose game has started can't be moved.
  const lockedToday = new Set<number>();
  if (todayIndex != null) {
    for (const p of current) {
      const g = p.games[todayIndex];
      if ((g && g.status !== "scheduled") || boardById.get(p.id)?.locked) lockedToday.add(p.id);
    }
  }
  // Per day: the roster players a previewed free agent moves to fit in.
  const shiftedByDay: Array<Set<number>> = days.map(() => new Set());

  // Who is in which slot, per day (a past day: as it stood, when that's on record).
  const dayAssign: Array<Map<number, number> | null> = days.map((d) => {
    if (d.kind === "past") {
      const stood = stoodOn(d.index);
      return stood ? new Map(stood) : null;
    }
    const setLineup = asSetByDay[d.index];
    if (setLineup && (d.kind === "today" || asSet)) {
      const m = new Map(setLineup);
      const here = inOn(d.index);
      if (here) {
        shiftedByDay[d.index] = seatIncomingBest({
          assign: m,
          incoming: here,
          roster: rosterOn(d.index),
          day: d.index,
          eligibleOf,
          slots,
          irIds,
          locked: d.kind === "today" ? lockedToday : new Set(),
        });
      }
      return m;
    }
    const cands: PlanCandidate[] = [];
    const out = replacedOn(d.index);
    for (const p of poolOn(d.index)) {
      if (p.id === out || irIds.has(p.id)) continue;
      const g = p.games[d.index];
      if (!g || g.out || g.status === "final") continue;
      cands.push({ id: p.id, avg: p.avg, eligible: eligibleOf(p) });
    }
    const plan = planDay(cands, slots);
    // Players who don't play keep their own spot (as set on ESPN for the day) while nobody who
    // plays needs it, as autoslot leaves them; the rest sit.
    const home = asSetByDay[d.index] ?? todayAssign;
    const used = new Map<number, number>();
    for (const slot of plan.values()) used.set(slot, (used.get(slot) ?? 0) + 1);
    const capacity = (slot: number) => slots.find((x) => x.slotId === slot)?.count ?? 0;
    for (const p of poolOn(d.index)) {
      if (plan.has(p.id)) continue;
      if (irIds.has(p.id)) {
        plan.set(p.id, IR_SLOT_ID);
        continue;
      }
      const g = p.games[d.index];
      const own = p.id !== out ? home?.get(p.id) : undefined;
      const idle = !g || g.out || g.status === "final";
      if (idle && own != null && isActiveSlot(own) && (used.get(own) ?? 0) < capacity(own)) {
        plan.set(p.id, own);
        used.set(own, (used.get(own) ?? 0) + 1);
      } else plan.set(p.id, BENCH_SLOT_ID);
    }
    return plan;
  });
  // Today's spots for a day with nothing of its own: an unplayed day's lineup, never another finished day's record.
  const unplayedAssign = dayAssign.find((m, i) => m && days[i].kind !== "past") ?? null;

  const cellFor = (p: SourcePlayer, d: WeekDay): GridCell => {
    const g = p.games[d.index];
    if (!g || offRoster(p, d.index) || (d.kind !== "past" && goneIds.has(p.id))) {
      return { state: "none", value: null, opp: null, note: null, counts: false, tag: null };
    }
    const base = { opp: g.opp, note: g.time, line: g.line ?? null };
    if (d.kind === "past") {
      // As it stood, only the active spots counted; with no record, every game shows as counted.
      const stood = stoodOn(d.index);
      const slot = stood?.get(p.id);
      if (stood && slot == null) return { state: "none", value: null, opp: null, note: null, counts: false, tag: null };
      const active = slot == null || isActiveSlot(slot);
      const tag: CellTag = active ? null : slot === IR_SLOT_ID ? "IR" : "BENCH";
      return g.fpts != null
        ? { ...base, state: "final", value: g.fpts, counts: active, tag }
        : { ...base, state: "dnp", value: null, counts: false, tag };
    }
    if (leftOn(p.id, d.index)) {
      return { ...base, state: g.status === "scheduled" ? "upcoming" : g.status, value: g.fpts ?? p.avg, counts: false, tag: "DROP" };
    }
    const slot = dayAssign[d.index]?.get(p.id);
    const active = slot != null && isActiveSlot(slot);
    const tag: CellTag = active ? null : slot === IR_SLOT_ID ? "IR" : d.kind === "today" || asSet ? "BENCH" : "SITS";
    if (g.status === "final") return { ...base, state: "final", value: g.fpts, counts: active, tag };
    if (g.status === "live") return { ...base, state: "live", value: g.fpts, note: g.clock, counts: active, tag };
    if (g.out) return { ...base, state: "out", value: null, counts: false, tag: null };
    return { ...base, state: "upcoming", value: p.avg, counts: active, tag };
  };

  /** What a counting cell adds to the expected finish. */
  const expected = (c: GridCell, p: SourcePlayer, d: WeekDay): number => {
    if (!c.counts) return 0;
    if (c.state === "final") return c.value ?? 0;
    if (c.state === "live") return (c.value ?? 0) + p.avg * (p.games[d.index]?.remaining ?? 0);
    if (c.state === "upcoming") return p.avg;
    return 0;
  };

  const rowFor = (p: SourcePlayer, kind: RowKind, slotId: number | null, slot: string): GridRow => {
    const cells = days.map((d) => cellFor(p, d));
    // A player leaving shows what he would have added (struck through in the UI).
    const total = days.reduce((sum, d, i) => sum + (cells[i].tag === "DROP" ? cells[i].value ?? 0 : expected(cells[i], p, d)), 0);
    const b = boardById.get(p.id);
    const isStaged = !!b && boardRows && pendingOn(viewDay, p.id);
    return {
      key: `${kind}-${p.id}`,
      kind,
      slot,
      slotId,
      player: p,
      cells,
      total: round1(total),
      staged: isStaged,
      outgoing: outIds.has(p.id),
      dropped: leaves.has(p.id) || undefined,
    };
  };

  // ---- rows, in the selected day's slot order ----
  const byId = new Map(pool.map((p) => [p.id, p]));
  const rows: GridRow[] = [];
  const viewStood = stoodOn(viewDay);
  if (viewStood) {
    // A finished day on record: its spots as they stood, read-only. Players
    // added since sit below it; those dropped since are in their spots.
    for (const s of slots) {
      const here = roster.filter((p) => viewStood.get(p.id) === s.slotId).sort((a, b) => b.avg - a.avg);
      for (let k = 0; k < Math.max(s.count, here.length); k++) {
        const p = here[k];
        rows.push(p ? rowFor(p, "player", s.slotId, slotName(s.slotId)) : openRow(s.slotId, k, days.length));
      }
    }
    const sat = (slot: number) =>
      roster
        .filter((p) => viewStood.get(p.id) === slot)
        .sort((a, b) => Number(!!b.games[viewDay]) - Number(!!a.games[viewDay]) || b.avg - a.avg);
    for (const p of sat(BENCH_SLOT_ID)) rows.push(rowFor(p, "player", BENCH_SLOT_ID, "BE"));
    for (const p of sat(IR_SLOT_ID)) rows.push(rowFor(p, "player", IR_SLOT_ID, "IR"));
    for (const p of current.filter((x) => !viewStood.has(x.id))) {
      rows.push({ ...rowFor(p, "player", null, "—"), later: true });
    }
  } else if (boardRows && viewBoard) {
    for (const r of slotRows(viewBoard.board, viewBoard.staged)) {
      const p = r.player ? byId.get(r.player.player_id) : undefined;
      if (r.player && p) rows.push(rowFor(p, "player", r.slot_id, r.slot));
      // Empty active slots (and an empty IR spot) stay as rows, so they can be dropped onto.
      else if (!r.player && (isActiveSlot(r.slot_id) || r.slot_id === IR_SLOT_ID)) {
        rows.push(openRow(r.slot_id, r.ordinal, days.length));
      }
    }
    // Rostered players the board doesn't list (it re-read before the week did).
    for (const p of current) {
      if (!rows.some((r) => r.player?.id === p.id)) rows.push(rowFor(p, "player", BENCH_SLOT_ID, "BE"));
    }
  } else {
    const assign = dayAssign[viewDay] ?? unplayedAssign ?? new Map<number, number>();
    for (const s of slots) {
      const here = poolOn(viewDay)
        .filter((p) => p.id !== replacedOn(viewDay) && assign.get(p.id) === s.slotId)
        .sort((a, b) => b.avg - a.avg);
      for (let k = 0; k < s.count; k++) {
        const p = here[k];
        if (p) rows.push(rowFor(p, inIds.has(p.id) ? "incoming" : "player", s.slotId, slotName(s.slotId)));
        else rows.push(openRow(s.slotId, k, days.length));
      }
    }
    const benched = current
      .filter((p) => !rows.some((r) => r.player?.id === p.id) && !irIds.has(p.id))
      .sort((a, b) => Number(!!b.games[viewDay]) - Number(!!a.games[viewDay]) || b.avg - a.avg);
    for (const p of benched) rows.push(rowFor(p, "player", BENCH_SLOT_ID, "BE"));
    for (const p of current.filter((x) => irIds.has(x.id))) rows.push(rowFor(p, "player", IR_SLOT_ID, "IR"));
  }

  // A previewed free agent sits in the spot the selected day gives him (an open
  // one of that slot when there is one); the player he replaces goes to the bottom,
  // with the players staged to drop.
  // A lane's free agents each get a row, on the bench on days they aren't in.
  for (const fa of incomers) {
    if (rows.some((r) => r.kind === "incoming" && r.player?.id === fa.id)) continue;
    const slotId = dayAssign[viewDay]?.get(fa.id) ?? BENCH_SLOT_ID;
    const active = isActiveSlot(slotId);
    const row = rowFor(fa, "incoming", slotId, active ? slotName(slotId) : "BE");
    const open = active ? rows.findIndex((r) => r.kind === "open" && r.slotId === slotId) : -1;
    if (open >= 0) rows.splice(open, 1, row);
    else {
      const group = active ? slotId : BENCH_SLOT_ID;
      let at = -1;
      rows.forEach((r, i) => {
        if (r.slotId === group) at = i;
      });
      if (at < 0) at = rows.findIndex((r) => r.slotId === IR_SLOT_ID) - 1;
      rows.splice(at < -1 ? rows.length : at + 1, 0, row);
    }
  }
  for (const p of outgoing) {
    const at = rows.findIndex((r) => r.player?.id === p.id && r.kind !== "incoming");
    if (at >= 0) rows.push({ ...rows.splice(at, 1)[0], slot: "DROP" });
  }

  // ---- totals ----
  const you: DayTotal[] = days.map((d) => {
    let actual = 0;
    let projected = 0;
    let starts = 0;
    for (const r of rows) {
      if (!r.player) continue;
      const c = r.cells[d.index];
      if (!c.counts) continue;
      if (c.state === "final" || c.state === "live") actual += c.value ?? 0;
      if (c.state === "upcoming") starts++;
      projected += expected(c, r.player, d);
    }
    if (d.kind === "past") {
      const api = source.pastTotals.you[d.index];
      const total = api ?? actual;
      return { actual: round1(total), projected: round1(total), starts: 0 };
    }
    return { actual: d.kind === "today" ? round1(actual) : null, projected: round1(projected), starts };
  });

  const activeCount = slots.reduce((n, s) => n + s.count, 0);
  const opp: DayTotal[] = days.map((d) => {
    if (d.kind === "past") {
      const api = source.pastTotals.opp[d.index];
      const total =
        api ??
        source.opponents.reduce((s, o) => s + (o.games[d.index]?.fpts ?? 0), 0);
      return { actual: round1(total), projected: round1(total), starts: 0 };
    }
    if (d.kind === "today") {
      let actual = 0;
      let projected = 0;
      let starts = 0;
      for (const o of source.opponents) {
        const g = o.games[d.index];
        if (!o.active || !g) continue;
        if (g.status === "final") {
          actual += g.fpts ?? 0;
          projected += g.fpts ?? 0;
        } else if (g.status === "live") {
          actual += g.fpts ?? 0;
          projected += (g.fpts ?? 0) + o.avg * g.remaining;
        } else if (!g.out) {
          projected += o.avg;
          starts++;
        }
      }
      return { actual: round1(actual), projected: round1(projected), starts };
    }
    // Future: the opponent's lineup as set (carried forward), or their best one,
    // approximated as their top projections.
    const healthy = source.opponents.filter((o) => o.games[d.index] && !o.games[d.index]!.out);
    const playing = asSet
      ? healthy.filter((o) => o.active)
      : healthy.sort((a, b) => b.avg - a.avg).slice(0, activeCount);
    return {
      actual: null,
      projected: round1(playing.reduce((s, o) => s + o.avg, 0)),
      starts: playing.length,
    };
  });

  // ---- every day's lineup, spot by spot ----
  // Order inside a slot: the day's own ESPN lineup order (or the nearest earlier one).
  const orderOf = (dayIndex: number): Map<number, number> => {
    const order = new Map<number, number>();
    let db: DayBoard | null = null;
    for (let i = dayIndex; i >= 0 && !db; i--) db = dayBoards[i];
    db ??= dayBoards.find((x) => x) ?? null;
    if (db) slotRows(db.board, db.staged).forEach((r, i) => r.player && order.set(r.player.player_id, i));
    // A previewed free agent who takes the replaced player's seat takes his place in the order too.
    const here = inOn(dayIndex);
    if (here && replaced != null && order.has(replaced)) order.set(here.player.id, order.get(replaced)!);
    return order;
  };
  const fallbackAssign = todayAssign ?? unplayedAssign ?? new Map<number, number>();
  const byDay = days.map((d) => {
    const assign = dayAssign[d.index] ?? fallbackAssign;
    // Lineups as set keep ESPN's order inside a slot; planned days go by projection.
    const fromBoard = !!todayAssign && (d.kind !== "future" || asSet);
    const boardOrder = fromBoard ? orderOf(d.index) : new Map<number, number>();
    const players = d.kind === "past" ? rosterOn(d.index) : poolOn(d.index).filter((p) => p.id !== replacedOn(d.index));
    const groups = new Map<number, SourcePlayer[]>();
    for (const p of players) {
      const slot = assign.get(p.id) ?? (irIds.has(p.id) ? IR_SLOT_ID : BENCH_SLOT_ID);
      const list = groups.get(slot) ?? [];
      list.push(p);
      groups.set(slot, list);
    }
    for (const list of groups.values()) {
      list.sort((a, b) =>
        fromBoard
          ? (boardOrder.get(a.id) ?? 999) - (boardOrder.get(b.id) ?? 999) || b.avg - a.avg
          : Number(!!b.games[d.index]) - Number(!!a.games[d.index]) || b.avg - a.avg
      );
    }
    return groups;
  });

  const spotCount = (slotId: number, capacity: number) =>
    Math.max(capacity, ...byDay.map((g) => g.get(slotId)?.length ?? 0));
  const slotDefs: SlotRowDef[] = [];
  for (const s of slots) {
    for (let k = 0; k < spotCount(s.slotId, s.count); k++) {
      slotDefs.push({ key: `${s.slotId}-${k}`, slotId: s.slotId, slot: slotName(s.slotId), group: "active" });
    }
  }
  const capacityOf = (id: number) => (board ? board.slots.find((s) => s.slot_id === id)?.count ?? 0 : 0);
  for (let k = 0; k < spotCount(BENCH_SLOT_ID, capacityOf(BENCH_SLOT_ID)); k++) {
    slotDefs.push({ key: `${BENCH_SLOT_ID}-${k}`, slotId: BENCH_SLOT_ID, slot: "BE", group: "bench" });
  }
  for (let k = 0; k < spotCount(IR_SLOT_ID, capacityOf(IR_SLOT_ID)); k++) {
    slotDefs.push({ key: `${IR_SLOT_ID}-${k}`, slotId: IR_SLOT_ID, slot: "IR", group: "ir" });
  }
  outgoing.forEach((_, k) => slotDefs.push({ key: `drop-${k}`, slotId: DROP_ROW_ID, slot: "DROP", group: "drop" }));

  const ordinalOf = (def: SlotRowDef) => Number(def.key.split("-")[1]);
  const seats = days.map((d, i) =>
    slotDefs.map((def): Seat | null => {
      // A player leaving: in his own spot on days already played (and before a
      // scheduled pickup's day), here from today (or that day) on.
      if (def.group === "drop") {
        const out = outgoing[ordinalOf(def)];
        return out && d.kind !== "past" && leftOn(out.id, d.index)
          ? { player: out, cell: cellFor(out, d), staged: false, incoming: false, outgoing: true, dropped: leaves.has(out.id) || undefined }
          : null;
      }
      const p = byDay[i].get(def.slotId)?.[ordinalOf(def)];
      if (!p) return null;
      const isStaged = (d.kind !== "future" || asSet) && pendingOn(d.index, p.id);
      return { player: p, cell: cellFor(p, d), staged: isStaged, incoming: inIds.has(p.id), shifted: shiftedByDay[i].has(p.id) };
    })
  );
  const boardDay = board ? (boardDayIndex >= 0 ? boardDayIndex : todayIndex) : null;
  // A day can be rearranged when its ESPN lineup is on screen as set: today in
  // either view, later days only in the as-set view.
  const editable = days.map(
    (d) => d.kind !== "past" && !!dayBoards[d.index] && (asSet || d.index === boardDay)
  );

  // Now = the provider's official score; the finish adds what is still to play.
  const nowYou =
    source.you.current ??
    you.reduce((s, t, i) => s + (days[i].kind === "future" ? 0 : t.actual ?? 0), 0);
  const nowOpp =
    source.opp.current ??
    opp.reduce((s, t, i) => s + (days[i].kind === "future" ? 0 : t.actual ?? 0), 0);
  const ahead = (totals: DayTotal[]) =>
    totals.reduce((s, t, i) => {
      const d = days[i];
      if (d.kind === "future") return s + (t.projected ?? 0);
      if (d.kind === "today") return s + (t.projected ?? 0) - (t.actual ?? 0);
      return s;
    }, 0);

  return {
    days,
    viewDay,
    rows,
    lineups: { slots: slotDefs, seats, boardDay, editable, asItStood: days.map((d) => !!stoodOn(d.index)) },
    you,
    opp,
    now: { you: round1(nowYou), opp: round1(nowOpp) },
    projected: { you: round1(nowYou + ahead(you)), opp: round1(nowOpp + ahead(opp)) },
    startsLeft: {
      you: you.reduce((s, t) => s + t.starts, 0),
      opp: opp.reduce((s, t) => s + t.starts, 0),
    },
  };
}

function sameAssignment(a: Map<number, number>, b: Map<number, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

function openRow(slotId: number, ordinal: number, dayCount: number): GridRow {
  return {
    key: `open-${slotId}-${ordinal}`,
    kind: "open",
    slot: slotName(slotId),
    slotId,
    player: null,
    cells: Array.from({ length: dayCount }, () => ({
      state: "none" as const,
      value: null,
      opp: null,
      note: null,
      counts: false,
      tag: null,
    })),
    total: 0,
    staged: false,
    outgoing: false,
  };
}

/** The daily lineups' row id for a player leaving the roster. */
export const DROP_ROW_ID = -1;

// Tie-breaks, far below any real projection: keep a player where he sits, keep
// a free agent who wouldn't score off an active spot, and seat a free agent at
// a position before UT (keeping UT open for whoever comes next). Each is worth
// less than the one before, so none of them ever costs an extra move.
const STAY = 0.01;
const BENCH_IF_IDLE = 0.005;
const FLEX = 0.002;
const UTIL_SLOT_ID = 11;
const FORBID = 1e9;

interface SeatInput {
  /** The day's lineup as set; updated in place. */
  assign: Map<number, number>;
  incoming: Incoming;
  roster: SourcePlayer[];
  day: number;
  eligibleOf: (p: SourcePlayer) => number[];
  slots: PlanSlot[];
  irIds: ReadonlySet<number>;
  /** Players whose games have started: they stay where they are. */
  locked: ReadonlySet<number>;
}

/**
 * Seat a previewed free agent where he helps most on a day whose lineup is
 * set: an exact assignment that maximizes the day's projected points, then
 * moves as few players as it can. It only makes room for him — starters may
 * change spots, one may drop to the bench where he takes the spot, but nobody
 * comes off the bench — so the preview shows the add, not an unrelated
 * lineup fix. ESPN's bench is unbounded (a spot may stay empty), so the
 * dropped player's spot is refilled only when that scores. Returns the
 * players it moved.
 */
function seatIncomingBest({ assign, incoming, roster, day, eligibleOf, slots, irIds, locked }: SeatInput): Set<number> {
  const before = new Map(assign);
  assign.delete(incoming.replaces);
  const fa = incoming.player;
  const value = (p: SourcePlayer) => {
    const g = p.games[day];
    return g && !g.out && g.status === "scheduled" ? p.avg : 0;
  };

  // Players who can move, and what the locked ones already hold.
  const movers = [...roster.filter((p) => p.id !== incoming.replaces && !irIds.has(p.id) && !locked.has(p.id)), fa]
    .filter((p) => p.id === fa.id || assign.get(p.id) !== IR_SLOT_ID);
  const held = new Map<number, number>();
  for (const [id, slot] of assign) {
    if (locked.has(id) && !irIds.has(id)) held.set(slot, (held.get(slot) ?? 0) + 1);
  }
  const instances: number[] = [];
  for (const sl of slots) for (let k = held.get(sl.slotId) ?? 0; k < sl.count; k++) instances.push(sl.slotId);
  // The bench takes everyone who can move.
  for (let k = 0; k < movers.length; k++) instances.push(BENCH_SLOT_ID);

  const cost = movers.map((p) => {
    const was = assign.get(p.id);
    // Benched, or not on the lineup ESPN sent: either way, not a starter to shuffle.
    const benched = p.id !== fa.id && (was === BENCH_SLOT_ID || was === undefined);
    const v = value(p);
    const eligible = eligibleOf(p);
    return instances.map((slot) => {
      if (slot !== BENCH_SLOT_ID) {
        // Nobody comes off the bench: the preview is about the add.
        if (benched || !eligible.includes(slot)) return FORBID;
        return -(v + (was === slot ? STAY : 0)) + (p.id === fa.id && slot === UTIL_SLOT_ID ? FLEX : 0);
      }
      return -((was === BENCH_SLOT_ID ? STAY : 0) + (p.id === fa.id && v === 0 ? BENCH_IF_IDLE : 0));
    });
  });

  const pick = assignMin(cost);
  movers.forEach((p, i) => {
    const slot = instances[pick[i]];
    if (slot != null && cost[i][pick[i]] < FORBID) assign.set(p.id, slot);
    else assign.set(p.id, BENCH_SLOT_ID);
  });

  const moved = new Set<number>();
  for (const p of movers) {
    if (p.id !== fa.id && before.get(p.id) !== assign.get(p.id)) moved.add(p.id);
  }
  return moved;
}

/**
 * Minimum-cost assignment of rows to columns (rows ≤ columns), the Hungarian
 * method: `result[row]` is the column it takes.
 */
export function assignMin(cost: number[][]): number[] {
  const n = cost.length;
  if (n === 0) return [];
  const m = cost[0].length;
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(m + 1).fill(0);
  const p = new Array<number>(m + 1).fill(0);
  const way = new Array<number>(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(m + 1).fill(Infinity);
    const used = new Array<boolean>(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const result = new Array<number>(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) result[p[j] - 1] = j - 1;
  return result;
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

const NAME_TO_SLOT: Record<string, number> = {
  PG: 0, SG: 1, SF: 2, PF: 3, C: 4, G: 5, F: 6,
  "SG/SF": 7, "G/F": 8, "PF/C": 9, "F/C": 10, UT: 11, UTIL: 11,
};

/** ["PG", "SG", "G", "UT"] → active slot ids; UT is always added (anyone can play it). */
export function slotsFromPositions(names: readonly string[]): number[] {
  const ids = new Set<number>();
  for (const n of names) {
    const id = NAME_TO_SLOT[n.toUpperCase().trim()];
    if (id !== undefined) ids.add(id);
  }
  if (ids.has(0) || ids.has(1)) ids.add(5);
  if (ids.has(2) || ids.has(3)) ids.add(6);
  ids.add(11);
  return [...ids].sort((a, b) => a - b);
}

const OUT_STATUSES = new Set(["OUT", "O", "IL", "IL+", "SUSPENSION", "INJURY_RESERVE"]);
const ACTIVE_STATUSES = new Set(["", "ACTIVE", "HEALTHY", "NORMAL"]);

/** A player's status as a strip colour: active, day-to-day (or questionable), or out / suspended. */
export type Health = "ok" | "dtd" | "out";

export function healthOf(status: string | null | undefined): Health {
  const s = (status ?? "").toUpperCase().trim();
  if (ACTIVE_STATUSES.has(s)) return "ok";
  return OUT_STATUSES.has(s) ? "out" : "dtd";
}

export function isOutStatus(status: string | null | undefined): boolean {
  return !!status && OUT_STATUSES.has(status.toUpperCase());
}

/** "PT04M12.00S" / "4:12" + period → "Q3 4:12" and the share of the game left. */
export function liveClock(period: number | null | undefined, clock: string | null | undefined): {
  label: string;
  remaining: number;
} {
  const q = period ?? 1;
  let minutes = 6;
  let label = "";
  const iso = /PT(\d+)M([\d.]+)S/.exec(clock ?? "");
  const plain = /^(\d{1,2}):(\d{2})/.exec(clock ?? "");
  if (iso) {
    minutes = Number(iso[1]) + Number(iso[2]) / 60;
    label = `${Number(iso[1])}:${String(Math.floor(Number(iso[2]))).padStart(2, "0")}`;
  } else if (plain) {
    minutes = Number(plain[1]) + Number(plain[2]) / 60;
    label = `${Number(plain[1])}:${plain[2]}`;
  }
  const quarter = q > 4 ? `OT${q - 4 > 1 ? q - 4 : ""}` : `Q${q}`;
  const left = q > 4 ? minutes / 48 : (Math.max(0, 4 - q) * 12 + minutes) / 48;
  return { label: label ? `${quarter} ${label}` : quarter, remaining: Math.min(1, Math.max(0, left)) };
}
