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
 *   past    — unknown (no lineup snapshots exist), so every played game shows
 *             and the day total is the API's (every rostered player's points);
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
  isActiveSlot,
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
  /** The API's day totals for finished days (every rostered player's points). */
  pastTotals: { you: Array<number | null>; opp: Array<number | null> };
  /** Active lineup spots, for teams with no ESPN board. */
  activeSlotCount: number;
}

/** A free agent previewed in place of a rostered player. */
export interface Incoming {
  player: SourcePlayer;
  /** The rostered player he would replace. */
  replaces: number;
}

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

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

export type CellState = "none" | "final" | "live" | "upcoming" | "out" | "dnp";

/** Why a game doesn't count: BENCH (on the ESPN bench), SITS (no room in the best lineup), IR, DROP (preview). */
export type CellTag = "BENCH" | "SITS" | "IR" | "DROP" | null;

export interface GridCell {
  state: CellState;
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
  /** Being replaced in the preview. */
  outgoing: boolean;
}

export interface DayTotal {
  /** Points scored so far (today) or the final (past). */
  actual: number | null;
  /** Expected finish for today and future days; the final for past days. */
  projected: number | null;
  starts: number;
}

export interface WeekGrid {
  days: WeekDay[];
  viewDay: number;
  rows: GridRow[];
  you: DayTotal[];
  opp: DayTotal[];
  now: { you: number; opp: number };
  projected: { you: number; opp: number };
  startsLeft: { you: number; opp: number };
}

/** How days ahead are lined up: as set on ESPN (carried forward) or the best fit for each day's games. */
export type LineupMode = "espn" | "best";

export interface GridInput {
  source: WeekSource;
  /** Today's ESPN board, when the team has one. */
  board: LineupState | null;
  staged: Staged;
  incoming: Incoming | null;
  /** The day the roster column describes. */
  viewDay: number;
  /** Default "espn". */
  mode?: LineupMode;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Days the roster column can show: today onward (all of them before the period starts). */
export function viewableDays(source: WeekSource): number[] {
  const from = source.todayIndex ?? (source.days.every((d) => d.kind === "past") ? source.days.length - 1 : 0);
  return source.days.filter((d) => d.index >= from).map((d) => d.index);
}

export function buildWeekGrid({ source, board, staged, incoming, viewDay, mode = "espn" }: GridInput): WeekGrid {
  const { days, todayIndex } = source;
  const asSet = mode === "espn" && board != null;
  // The roster column follows the ESPN board on every day it applies to.
  const boardRows = board != null && (asSet || viewDay === todayIndex);
  const slots = activeSlots(board, source.activeSlotCount);
  const boardById = new Map((board?.players ?? []).map((p) => [p.player_id, p]));
  const todayAssign = board ? boardAssignment(board, staged) : null;
  const irIds = new Set(
    (board?.players ?? []).filter((p) => p.lineup_slot_id === IR_SLOT_ID).map((p) => p.player_id)
  );

  const eligibleOf = (p: SourcePlayer): number[] => {
    const b = boardById.get(p.id);
    return b ? b.eligible_slot_ids.filter(isActiveSlot) : p.eligible;
  };

  const roster = source.mine;
  const replaced = incoming?.replaces ?? null;
  const pool: SourcePlayer[] = incoming ? [...roster, incoming.player] : roster;
  const inId = incoming?.player.id ?? null;

  // Who is in which slot, per day (past days: unknown).
  const dayAssign: Array<Map<number, number> | null> = days.map((d) => {
    if (d.kind === "past") return null;
    if (todayAssign && (d.kind === "today" || asSet)) {
      const m = new Map(todayAssign);
      if (incoming) seatIncomingToday(m, incoming, eligibleOf(incoming.player), slots);
      return m;
    }
    const cands: PlanCandidate[] = [];
    for (const p of pool) {
      if (p.id === replaced || irIds.has(p.id)) continue;
      const g = p.games[d.index];
      if (!g || g.out || g.status === "final") continue;
      cands.push({ id: p.id, avg: p.avg, eligible: eligibleOf(p) });
    }
    const plan = planDay(cands, slots);
    for (const p of pool) {
      if (!plan.has(p.id)) plan.set(p.id, irIds.has(p.id) ? IR_SLOT_ID : BENCH_SLOT_ID);
    }
    return plan;
  });

  const cellFor = (p: SourcePlayer, d: WeekDay): GridCell => {
    const g = p.games[d.index];
    if (!g) return { state: "none", value: null, opp: null, note: null, counts: false, tag: null };
    const base = { opp: g.opp, note: g.time };
    if (d.kind === "past") {
      return g.fpts != null
        ? { ...base, state: "final", value: g.fpts, counts: true, tag: null }
        : { ...base, state: "dnp", value: null, counts: false, tag: null };
    }
    if (p.id === replaced) {
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
    // A player being replaced shows what he would have added (struck through in the UI).
    const total =
      p.id === replaced
        ? days.reduce((sum, d, i) => sum + (cells[i].tag === "DROP" ? cells[i].value ?? 0 : expected(cells[i], p, d)), 0)
        : days.reduce((sum, d, i) => sum + expected(cells[i], p, d), 0);
    const b = boardById.get(p.id);
    const isStaged = !!b && staged[p.id] !== undefined && boardRows;
    return {
      key: `${kind}-${p.id}`,
      kind,
      slot,
      slotId,
      player: p,
      cells,
      total: round1(total),
      staged: isStaged,
      outgoing: p.id === replaced,
    };
  };

  // ---- rows, in the selected day's slot order ----
  const byId = new Map(pool.map((p) => [p.id, p]));
  const rows: GridRow[] = [];
  if (boardRows && board) {
    for (const r of slotRows(board, staged)) {
      const p = r.player ? byId.get(r.player.player_id) : undefined;
      if (r.player && p) rows.push(rowFor(p, "player", r.slot_id, r.slot));
      // Empty active slots (and an empty IR spot) stay as rows, so they can be dropped onto.
      else if (!r.player && (isActiveSlot(r.slot_id) || r.slot_id === IR_SLOT_ID)) {
        rows.push(openRow(r.slot_id, r.ordinal, days.length));
      }
    }
    // Rostered players the board doesn't list (it re-read before the week did).
    for (const p of roster) {
      if (!rows.some((r) => r.player?.id === p.id)) rows.push(rowFor(p, "player", BENCH_SLOT_ID, "BE"));
    }
  } else {
    const assign = dayAssign[viewDay] ?? dayAssign.find((m) => m) ?? new Map<number, number>();
    for (const s of slots) {
      const here = pool
        .filter((p) => p.id !== replaced && assign.get(p.id) === s.slotId)
        .sort((a, b) => b.avg - a.avg);
      for (let k = 0; k < s.count; k++) {
        const p = here[k];
        if (p?.id === inId) continue; // drawn under the player he replaces, below
        if (p) rows.push(rowFor(p, "player", s.slotId, slotName(s.slotId)));
        else rows.push(openRow(s.slotId, k, days.length));
      }
    }
    const benched = roster
      .filter((p) => !rows.some((r) => r.player?.id === p.id) && !irIds.has(p.id))
      .sort((a, b) => Number(!!b.games[viewDay]) - Number(!!a.games[viewDay]) || b.avg - a.avg);
    for (const p of benched) rows.push(rowFor(p, "player", BENCH_SLOT_ID, "BE"));
    for (const p of roster.filter((x) => irIds.has(x.id))) rows.push(rowFor(p, "player", IR_SLOT_ID, "IR"));
  }

  // A previewed free agent sits directly under the player he would replace.
  if (incoming) {
    const slotId = dayAssign[viewDay]?.get(incoming.player.id) ?? null;
    if (boardRows && slotId != null && isActiveSlot(slotId)) {
      // Seated in an empty slot on the board: that slot is no longer open.
      const open = rows.findIndex((r) => r.kind === "open" && r.slotId === slotId);
      if (open >= 0) rows.splice(open, 1);
    }
    const at = rows.findIndex((r) => r.player?.id === incoming.replaces);
    const label = slotId != null && isActiveSlot(slotId) ? slotName(slotId) : "IN";
    const row = rowFor(incoming.player, "incoming", slotId, label);
    if (at >= 0) rows.splice(at + 1, 0, row);
    else rows.push(row);
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

/**
 * Today, a previewed free agent takes the replaced player's seat when he is
 * eligible for it, else any empty active slot he fits, else the bench.
 */
function seatIncomingToday(
  assign: Map<number, number>,
  incoming: Incoming,
  eligible: number[],
  slots: PlanSlot[]
): void {
  const vacated = assign.get(incoming.replaces);
  assign.delete(incoming.replaces);
  if (vacated != null && isActiveSlot(vacated) && eligible.includes(vacated)) {
    assign.set(incoming.player.id, vacated);
    return;
  }
  for (const s of slots) {
    if (!eligible.includes(s.slotId)) continue;
    const held = [...assign.values()].filter((v) => v === s.slotId).length;
    if (held < s.count) {
      assign.set(incoming.player.id, s.slotId);
      return;
    }
  }
  assign.set(incoming.player.id, BENCH_SLOT_ID);
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
