/**
 * Court Vision's live rankings as Scout shows them, the part with no DOM.
 *
 * The backend stores two rest-of-season boards every morning (ESPN default
 * points and standard 9-cat) with ESPN's own rank beside them, and serves the
 * newest with each player's move over a day and a week (`GET /v1/rankings/live`)
 * and one player's rank on every stored day (`…/live/players/{id}`). This turns
 * those into the rows of the Rankings board, the day's movers, the words beside
 * ESPN's rank, and the geometry of the rank-over-time chart. Nothing here
 * invents a number: a move the backend could not measure stays null.
 */
import { hasPosition, monthDay, type PosFilter } from "@/lib/scout";
import type { EspnRankAge, LivePlayerRankData, LiveRankingsData, LiveRankingsPlayer } from "@/types/scout";

/** The two stored boards, as the pool's own formats spell them. */
export type LiveBoard = "points" | "categories";

export const LIVE_BOARDS: ReadonlyArray<{ id: LiveBoard; label: string; title: string }> = [
  { id: "points", label: "PTS", title: "ESPN default points" },
  { id: "categories", label: "9-CAT", title: "Standard nine categories" },
];

/** One player on one board. */
export interface LiveRow {
  id: number;
  name: string;
  team: string | null;
  position: string | null;
  /** The availability flag the board was built with; null plays. */
  status: string | null;
  /** Games he is expected to play from the board's day on. */
  games: number | null;
  rank: number;
  /** The per-game number the board shows, on the fantasy-points scale on both boards. */
  value: number | null;
  /** Places gained since the previous stored board; null when it could not be measured. */
  day: number | null;
  /** Places gained since the board of a week ago; null when it could not be measured. */
  week: number | null;
  espnRank: number | null;
  /** ESPN's rank minus ours: positive when Court Vision has him higher than ESPN does. */
  gap: number | null;
}

/** Everyone on `board`, best first. */
export function liveRows(players: readonly LiveRankingsPlayer[] | null | undefined, board: LiveBoard): LiveRow[] {
  const rows: LiveRow[] = [];
  for (const p of players ?? []) {
    const place = p[board];
    if (!place) continue;
    rows.push({
      id: p.player_id,
      name: p.name,
      team: p.team,
      position: p.position,
      status: p.injury_status,
      games: p.games,
      rank: place.rank,
      value: place.value,
      day: place.move_1d,
      week: place.move_7d,
      espnRank: place.espn_rank,
      gap: place.espn_rank == null ? null : place.espn_rank - place.rank,
    });
  }
  return rows.sort((a, b) => a.rank - b.rank);
}

export type LiveSort = "rank" | "day" | "week" | "espn" | "name";

export const LIVE_SORTS: ReadonlyArray<{ v: LiveSort; label: string; title: string }> = [
  { v: "rank", label: "RANK", title: "By the board" },
  { v: "day", label: "1D", title: "By places gained since the previous board" },
  { v: "week", label: "7D", title: "By places gained since the board of a week ago" },
  { v: "espn", label: "VS ESPN", title: "By how far above ESPN's rank Court Vision has him" },
  { v: "name", label: "A–Z", title: "By name" },
];

/** Biggest first, the unmeasured last, the board's own order between equals. */
function byNumber(pick: (r: LiveRow) => number | null) {
  return (a: LiveRow, b: LiveRow) => {
    const x = pick(a);
    const y = pick(b);
    if (x == null || y == null) return (x == null ? 1 : 0) - (y == null ? 1 : 0) || a.rank - b.rank;
    return y - x || a.rank - b.rank;
  };
}

export function sortLive(rows: readonly LiveRow[], sort: LiveSort): LiveRow[] {
  const out = [...rows];
  switch (sort) {
    case "day":
      return out.sort(byNumber((r) => r.day));
    case "week":
      return out.sort(byNumber((r) => r.week));
    case "espn":
      return out.sort(byNumber((r) => r.gap));
    case "name":
      return out.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return out.sort((a, b) => a.rank - b.rank);
  }
}

export function filterLive(rows: readonly LiveRow[], pos: PosFilter, sort: LiveSort): LiveRow[] {
  return sortLive(
    rows.filter((r) => hasPosition(r.position, pos)),
    sort
  );
}

export type MoveSpan = "day" | "week";

/** How deep a board a mover has to reach to count: the players a twelve-team league rosters. */
export const MOVERS_WITHIN = 150;

/**
 * The board's biggest risers and fallers over a day or a week. Far down a
 * board a few decimals move a player thirty places and nobody's roster
 * changes, so a mover has to be inside `within` now or to have been before.
 */
export function liveMovers(rows: readonly LiveRow[], span: MoveSpan, limit: number = 8, within: number = MOVERS_WITHIN): { up: LiveRow[]; down: LiveRow[] } {
  const moved = rows.filter((r) => {
    const move = r[span];
    return move != null && move !== 0 && Math.min(r.rank, r.rank + move) <= within;
  });
  const up = moved.filter((r) => (r[span] as number) > 0).sort((a, b) => (b[span] as number) - (a[span] as number) || a.rank - b.rank);
  const down = moved.filter((r) => (r[span] as number) < 0).sort((a, b) => (a[span] as number) - (b[span] as number) || a.rank - b.rank);
  return { up: up.slice(0, limit), down: down.slice(0, limit) };
}

/** The player Court Vision and ESPN disagree about most, among the first `within` of the board. */
export function widestGap(rows: readonly LiveRow[], within: number = 100): LiveRow | null {
  let best: LiveRow | null = null;
  for (const r of rows) {
    if (r.gap == null || r.rank > within) continue;
    if (!best || Math.abs(r.gap) > Math.abs(best.gap as number)) best = r;
  }
  return best && best.gap !== 0 ? best : null;
}

/** A whole-number change with its sign: "+6", "−3", "0", or a dash when there is none to give. */
export function fmtPlaces(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n === 0) return "0";
  return `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
}

/** A gap to ESPN in words: "6 above ESPN", "3 below ESPN", "level with ESPN". */
export function gapText(gap: number | null | undefined): string | null {
  if (gap == null) return null;
  if (gap === 0) return "level with ESPN";
  return `${Math.abs(gap)} ${gap > 0 ? "above" : "below"} ESPN`;
}

/** What the moves are measured against: "vs Nov 20 and Nov 14", or why there is nothing to measure yet. */
export function comparedText(compared: LiveRankingsData["compared"] | null | undefined): string {
  const day = compared?.day ? monthDay(compared.day) : null;
  const week = compared?.week ? monthDay(compared.week) : null;
  if (day && week) return `moves since ${day} and ${week}`;
  if (day) return `moves since ${day} · a week of boards is not stored yet`;
  if (week) return `moves since ${week}`;
  return "no earlier board to measure moves against yet";
}

/** How long ESPN has held its rank: "held since Nov 19", or "since at least Nov 12" when the run reaches the first stored day. */
export function espnAgeText(age: EspnRankAge | null | undefined): string | null {
  if (!age) return null;
  return `held since ${age.since_first_stored ? "at least " : ""}${monthDay(age.unchanged_since)}`;
}

/** The availability flag a board was built with, as a chip prints it: "DTD", "OUT", "SUSP". */
export function flagText(status: string | null | undefined): string | null {
  const raw = (status ?? "").toUpperCase().trim();
  if (!raw || raw === "ACTIVE" || raw === "HEALTHY") return null;
  if (raw === "DAY_TO_DAY" || raw === "DTD") return "DTD";
  if (raw.startsWith("OUT")) return "OUT";
  if (raw.includes("SUSP")) return "SUSP";
  return raw.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Rank over time
// ---------------------------------------------------------------------------

/**
 * One stored day of one board: our rank and ESPN's, either of which he may not
 * have had. `cvStored` and `espnStored` say whether that source stored a board
 * at all that day: a rank missing from a stored board is a day he was off it,
 * a board that was never stored is only a morning the pipeline missed.
 */
export interface RankPoint {
  day: string;
  cv: number | null;
  espn: number | null;
  cvStored: boolean;
  espnStored: boolean;
}

/**
 * A player's days on `board`, oldest first: every day either source stored a
 * board, from the first one that ranked him to the newest. His history alone
 * only has the days he was ranked, so the days he was off a board come from
 * the lists of stored days beside it.
 */
export function rankPoints(sheet: Pick<LivePlayerRankData, "history" | "board_days" | "espn_days"> | null | undefined, board: LiveBoard): RankPoint[] {
  const byDay = new Map((sheet?.history ?? []).map((d) => [d.as_of, d]));
  const ours = new Set(sheet?.board_days ?? []);
  const theirs = new Set(sheet?.espn_days ?? []);
  const points = [...new Set([...ours, ...theirs, ...byDay.keys()])].sort().map((day) => {
    const d = byDay.get(day);
    const cv = (board === "points" ? d?.points : d?.categories) ?? null;
    const espn = (board === "points" ? d?.espn_points : d?.espn_categories) ?? null;
    // A rank is proof the board was stored, whatever the lists say
    return { day, cv, espn, cvStored: cv != null || ours.has(day), espnStored: espn != null || theirs.has(day) };
  });
  const first = points.findIndex((p) => p.cv != null || p.espn != null);
  return first < 0 ? [] : points.slice(first);
}

const DAY_MS = 86_400_000;
const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

/** The fewest places the chart's height ever spans, so a rank that never moved is a flat line, not a cliff. */
const MIN_SPAN = 6;

export interface RankChartGeometry {
  /** The best and worst rank on the axis; the best is at the top. */
  best: number;
  worst: number;
  /** Clean ranks to rule the plot at, best first. */
  ticks: number[];
  x: (day: string) => number;
  y: (rank: number) => number;
  /** Each source's unbroken runs (`rankRuns`), as SVG path data. A day he was off the board breaks the line. */
  cv: string[];
  espn: string[];
}

/**
 * Each unbroken run of `key`'s ranks, as indexes into `points`. A day the
 * source stored a board without him ends a run; a day it stored no board at
 * all is stepped over, and the line runs on across it.
 */
export function rankRuns(points: readonly RankPoint[], key: "cv" | "espn"): number[][] {
  const out: number[][] = [];
  let run: number[] = [];
  points.forEach((p, i) => {
    if (p[key] != null) {
      run.push(i);
    } else if (p[key === "cv" ? "cvStored" : "espnStored"] && run.length) {
      out.push(run);
      run = [];
    }
  });
  if (run.length) out.push(run);
  return out;
}

/**
 * Where everything in the rank chart goes, in a `width` by `height` box with
 * `pad` kept clear on every side. Rank 1 is at the top, days are spaced by the
 * calendar (a morning the board was not stored is a gap, not a skipped slot),
 * and a single day sits in the middle. Null when there is nothing to draw.
 */
export function rankChart(points: readonly RankPoint[], width: number, height: number, pad: { top: number; right: number; bottom: number; left: number }): RankChartGeometry | null {
  const ranks = points.flatMap((p) => [p.cv, p.espn]).filter((r): r is number => r != null);
  if (!ranks.length) return null;
  let best = Math.min(...ranks);
  let worst = Math.max(...ranks);
  if (worst - best < MIN_SPAN) {
    const grow = MIN_SPAN - (worst - best);
    best = Math.max(1, best - Math.floor(grow / 2));
    worst = best + MIN_SPAN;
  }
  const first = dayNumber(points[0].day);
  const span = dayNumber(points[points.length - 1].day) - first;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (day: string) => pad.left + (span === 0 ? plotW / 2 : ((dayNumber(day) - first) / span) * plotW);
  const y = (rank: number) => pad.top + ((rank - best) / (worst - best)) * plotH;
  const paths = (key: "cv" | "espn") =>
    rankRuns(points, key).map((run) => run.map((i, n) => `${n ? "L" : "M"}${x(points[i].day).toFixed(1)} ${y(points[i][key] as number).toFixed(1)}`).join(" "));
  return { best, worst, ticks: rankTicks(best, worst), x, y, cv: paths("cv"), espn: paths("espn") };
}

/** Three or four clean ranks between `best` and `worst`, both ends included. */
export function rankTicks(best: number, worst: number): number[] {
  const span = worst - best;
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200].find((s) => span / s <= 3) ?? 200;
  const ticks = [best];
  for (let t = Math.ceil((best + 1) / step) * step; t < worst; t += step) {
    // A rule a hair from an end would print one label over another
    if (t - best >= step * 0.6 && worst - t >= step * 0.6) ticks.push(t);
  }
  ticks.push(worst);
  return ticks;
}

/** The last day `key` has a rank on, as an index into `points`; -1 when it never has one. */
export function lastDay(points: readonly RankPoint[], key: "cv" | "espn"): number {
  for (let i = points.length - 1; i >= 0; i--) if (points[i][key] != null) return i;
  return -1;
}

/** The days `key` has a rank with none on the stored day either side: a line needs two points, so these are drawn as dots. */
export function loneDays(points: readonly RankPoint[], key: "cv" | "espn"): number[] {
  return rankRuns(points, key)
    .filter((run) => run.length === 1)
    .map((run) => run[0]);
}

/**
 * Which days get a label under the plot: the first, the last, and as many
 * between as fit `minGap` apart. The last day always keeps its label, at the
 * cost of a neighbour too close to it.
 */
export function dayTicks(points: readonly RankPoint[], geometry: RankChartGeometry, minGap: number = 64): number[] {
  if (!points.length) return [];
  const out = [0];
  for (let i = 1; i < points.length; i++) {
    if (geometry.x(points[i].day) - geometry.x(points[out[out.length - 1]].day) >= minGap) out.push(i);
  }
  const last = points.length - 1;
  if (out[out.length - 1] !== last) {
    if (out.length > 1 && geometry.x(points[last].day) - geometry.x(points[out[out.length - 1]].day) < minGap) out.pop();
    out.push(last);
  }
  return out;
}

/**
 * Where two labels at the same x sit so that neither prints over the other:
 * each at its own height when they are `min` apart, else `min` apart around
 * their midpoint with the higher one above (the first, when level).
 */
export function spreadLabels(a: number | null, b: number | null, min: number = 12): [number | null, number | null] {
  if (a == null || b == null || Math.abs(a - b) >= min) return [a, b];
  const mid = (a + b) / 2;
  return a <= b ? [mid - min / 2, mid + min / 2] : [mid + min / 2, mid - min / 2];
}

/** The stored day nearest a horizontal position in the chart: what the crosshair snaps to. */
export function nearestPoint(points: readonly RankPoint[], geometry: RankChartGeometry, px: number): number {
  let at = 0;
  let nearest = Infinity;
  points.forEach((p, i) => {
    const d = Math.abs(geometry.x(p.day) - px);
    if (d < nearest) {
      nearest = d;
      at = i;
    }
  });
  return at;
}

/** The chart in a sentence, for a reader who cannot see it. */
export function rankChartSummary(points: readonly RankPoint[], name: string, board: LiveBoard): string {
  const boardName = board === "points" ? "points" : "9-cat";
  const ours = points.filter((p) => p.cv != null);
  if (!ours.length) return `${name} has not been on Court Vision's ${boardName} board this season.`;
  const first = ours[0];
  const last = ours[ours.length - 1];
  const best = Math.min(...ours.map((p) => p.cv as number));
  const worst = Math.max(...ours.map((p) => p.cv as number));
  const theirs = [...points].reverse().find((p) => p.espn != null);
  return (
    `${name} on Court Vision's ${boardName} board: rank ${first.cv} on ${monthDay(first.day)}, rank ${last.cv} on ${monthDay(last.day)}, ` +
    `between ${best} and ${worst} over ${ours.length} stored ${ours.length === 1 ? "day" : "days"}.` +
    (theirs ? ` ESPN ranked him ${theirs.espn} on ${monthDay(theirs.day)}.` : "")
  );
}
