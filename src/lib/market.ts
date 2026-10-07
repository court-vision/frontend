/**
 * The week desk's market: free agents judged by what they add to *this* week.
 *
 * The streamer search ranks the pool by its own score; the desk re-ranks it
 * by the change to your projected week, with the free agent started on his
 * game days in the best lineup each day and the roster player he replaces
 * dropped. The grid already computes exactly that for a preview, so the gain
 * is the grid with the move minus the grid without — these helpers only pick
 * the candidates, read the difference and describe a player's week.
 */
import type { BreakoutCandidateResp } from "@/types/breakout";
import type { LineupState } from "@/types/lineup-editor";
import type { StreamerPlayer } from "@/types/streamer";
import { IR_SLOT_ID } from "./lineup-editor";
import type { WeekDay, WeekGrid, WeekSource } from "./week-grid";

/** `replaces` for an add that drops nobody (a roster with room). */
export const NO_DROP = -1;

export interface DropOption {
  /** The roster player dropped, or NO_DROP. */
  dropId: number;
  /** Change to your projected week. */
  week: number;
  /** The same change, day by day. */
  byDay: number[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The change a move makes: `after` (the grid with it) minus `base`, the week and each day. */
export function gainOf(base: WeekGrid, after: WeekGrid, dropId: number): DropOption {
  return {
    dropId,
    week: round1(after.projected.you - base.projected.you),
    byDay: after.you.map((d, i) => round1((d.projected ?? 0) - (base.you[i]?.projected ?? 0))),
  };
}

/** The better of two options for ranking: a day's gain first when one is asked for, then the week. */
export function better(a: DropOption | null, b: DropOption, day: number | null): DropOption {
  if (!a) return b;
  const ka = day != null ? a.byDay[day] ?? 0 : a.week;
  const kb = day != null ? b.byDay[day] ?? 0 : b.week;
  if (kb !== ka) return kb > ka ? b : a;
  return b.week > a.week ? b : a;
}

/**
 * Who a streamer most plausibly replaces: the lowest projected players, never
 * one sitting on IR (he holds no roster spot worth trading).
 */
export function dropCandidates(source: WeekSource, board: LineupState | null, k = 5): number[] {
  const ir = new Set((board?.players ?? []).filter((p) => p.lineup_slot_id === IR_SLOT_ID).map((p) => p.player_id));
  return source.mine
    .filter((p) => !ir.has(p.id))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, k)
    .map((p) => p.id);
}

/**
 * The first day an add made now counts: ESPN puts a pickup made after a day's
 * first tip on the next day. Null when today still counts (or the week is ahead).
 * Read off the week itself: any game today under way or over, for either side.
 */
export function addsCountFrom(source: WeekSource, board: LineupState | null): number | null {
  const today = source.todayIndex;
  if (today == null) return null;
  const started =
    [...source.mine, ...source.opponents].some((p) => {
      const g = p.games[today];
      return !!g && g.status !== "scheduled";
    }) || (board?.players.some((p) => p.game_started) ?? false);
  return started ? today + 1 : null;
}

/** Open roster spots: room to add without dropping anyone. */
export function rosterRoom(board: LineupState | null): number {
  if (!board) return 0;
  const spots = board.slots.filter((s) => s.slot_id !== IR_SLOT_ID).reduce((n, s) => n + s.count, 0);
  const held = board.players.filter((p) => p.lineup_slot_id !== IR_SLOT_ID).length;
  return Math.max(0, spots - held);
}

/**
 * Active spots each day that no counted game fills, in the best lineup:
 * where a streamer's game counts without displacing anyone. Past days, none.
 */
export function openSpots(grid: WeekGrid): number[] {
  const active = grid.lineups.slots.map((s, i) => (s.group === "active" ? i : -1)).filter((i) => i >= 0);
  return grid.days.map((d) => {
    if (d.kind === "past") return 0;
    const seats = grid.lineups.seats[d.index] ?? [];
    return active.filter((i) => {
      const seat = seats[i];
      return !seat || !seat.cell.counts || seat.cell.state === "none";
    }).length;
  });
}

export type StripState = "none" | "past" | "open" | "busy";

/**
 * A free agent's week at a glance: a game that lands in an open spot, one that
 * must displace someone, one too soon to count (`firstDay`: the first day an
 * add made now counts), none.
 */
export function stripFor(
  fa: Pick<StreamerPlayer, "game_days">,
  days: WeekDay[],
  open: number[],
  firstDay: number | null = null
): StripState[] {
  const playing = new Set(fa.game_days);
  return days.map((d) => {
    if (!playing.has(d.index)) return "none";
    if (d.kind === "past" || (firstDay != null && d.index < firstDay)) return "past";
    return (open[d.index] ?? 0) > 0 ? "open" : "busy";
  });
}

export type PositionFilter = "all" | "PG" | "SG" | "SF" | "PF" | "C";

export interface MarketFilters {
  position: PositionFilter;
  b2bOnly: boolean;
  hideInjured: boolean;
  hideWaivers: boolean;
  query: string;
}

export const DEFAULT_FILTERS: MarketFilters = { position: "all", b2bOnly: false, hideInjured: false, hideWaivers: false, query: "" };

export function isInjured(fa: Pick<StreamerPlayer, "injured" | "injury_status">): boolean {
  const s = (fa.injury_status ?? "").toUpperCase();
  return fa.injured || (s !== "" && s !== "ACTIVE" && s !== "HEALTHY");
}

export function matchesFilters(fa: StreamerPlayer, f: MarketFilters): boolean {
  if (f.position !== "all" && !fa.valid_positions.includes(f.position)) return false;
  if (f.b2bOnly && !fa.has_b2b) return false;
  if (f.hideInjured && isInjured(fa)) return false;
  if (f.hideWaivers && fa.acquisition_status === "waivers") return false;
  const q = f.query.trim().toLowerCase();
  if (q && !fa.name.toLowerCase().includes(q) && fa.team.toLowerCase() !== q) return false;
  return true;
}

/** "PG/SG": the primary spots, without the G/F/UT catch-alls. */
export function positionLabel(fa: Pick<StreamerPlayer, "valid_positions">): string {
  const core = fa.valid_positions.filter((p) => ["PG", "SG", "SF", "PF", "C"].includes(p));
  return (core.length ? core : fa.valid_positions.slice(0, 2)).join("/");
}

export interface BreakoutRow {
  candidate: BreakoutCandidateResp;
  /** The beneficiary in your league's free-agent pool, when he is in it. */
  fa: StreamerPlayer | null;
}

/**
 * Breakout candidates against your league's pool. The breakout list is
 * league-blind, so a beneficiary already rostered elsewhere (or beyond the
 * pool searched) comes back with no free agent beside him.
 */
export function joinBreakouts(candidates: BreakoutCandidateResp[], pool: StreamerPlayer[]): BreakoutRow[] {
  const byEspn = new Map(pool.map((f) => [f.player_id, f]));
  const byNba = new Map(pool.filter((f) => f.nba_player_id != null).map((f) => [f.nba_player_id!, f]));
  return candidates.map((candidate) => {
    const b = candidate.beneficiary;
    const fa = byEspn.get(b.player_id) ?? (b.nba_player_id != null ? byNba.get(b.nba_player_id) : undefined) ?? null;
    return { candidate, fa };
  });
}
