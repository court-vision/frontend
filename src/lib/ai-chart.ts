/**
 * The AI desk's chart block, the part with no DOM: where a block's lookups
 * came from in words, how a value is written, and the geometry of a bar or
 * line chart drawn from an `AiChart` (backend services/ai/display.py), the
 * server's copy of stored results: categories along x and up to four series
 * of numbers, with `null` for a gap. Nothing here invents a value; it places
 * the ones the chart carries, and components/ai/Blocks.tsx draws them.
 */
import type { AiChart, AiChartSeries } from "@/types/ai";

/** Where a lookup's rows came from, in words. */
export const SOURCES: Record<string, string> = {
  get_free_agents: "free agents",
  get_matchup: "your matchup",
  get_game_log: "box scores",
  get_player_stats: "player stats",
  get_scheduled_pickups: "scheduled pickups",
  get_projections: "projections",
  get_draft_market: "the draft market",
  get_market_movement: "draft market moves",
  get_schedule: "the schedule",
  get_draft_room: "your draft room",
  get_draft_rooms: "your draft rooms",
  search_players: "player search",
};

export function sourcesOf(tools: readonly string[]): string {
  return tools.map((t) => SOURCES[t] ?? t).join(", ");
}

/** A value as the block writes it: integers as they are, others to two decimals, a gap as "—". */
export function formatValue(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** An ISO date as "Oct 21"; anything else as it is. */
export function shortCategory(c: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(c);
  if (!m) return c;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}` : c;
}

// ---- the value axis

export interface Scale {
  min: number;
  max: number;
  ticks: number[];
}

const STEPS = [1, 2, 2.5, 5, 10];

/**
 * A value axis that holds zero and every value, with about `maxTicks` round
 * ticks (a 1, 2, 2.5 or 5 step at some power of ten). No values, or all
 * zero, gives 0..1.
 */
export function niceScale(values: ReadonlyArray<number | null | undefined>, maxTicks = 5): Scale {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const lo = Math.min(0, ...nums);
  let hi = Math.max(0, ...nums);
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / Math.max(1, maxTicks);
  const mag = 10 ** Math.floor(Math.log10(raw));
  // Trimmed to 12 digits so that -0.4 / 0.1 is -4, not a hair below it
  const q = (n: number) => Number(n.toPrecision(12));
  const step = q((STEPS.find((s) => s * mag >= raw) ?? 10) * mag);
  const places = (String(step).split(".")[1] ?? "").length;
  const fix = (n: number) => Number(n.toFixed(places)) || 0; // and never -0
  const min = fix(Math.floor(q(lo / step)) * step);
  const max = fix(Math.ceil(q(hi / step)) * step);
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(fix(t));
  return { min, max, ticks };
}

/** Where a value sits along the axis, 0 at its start and 1 at its end. */
export function position(v: number, scale: Scale): number {
  return (v - scale.min) / (scale.max - scale.min);
}

/** A bar for `v` growing from zero either way: where it starts and how far it reaches, as fractions of the axis. */
export function barSpan(v: number, scale: Scale): { start: number; width: number } {
  const zero = position(0, scale);
  const end = position(v, scale);
  return { start: Math.min(zero, end), width: Math.abs(end - zero) };
}

// ---- lines

export interface Plot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
  /** The category's index. */
  i: number;
}

/** Each category's x across the plot, the first at its left edge and the last at its right. */
export function categoryX(i: number, count: number, plot: Plot): number {
  return count < 2 ? plot.x + plot.w / 2 : plot.x + (i / (count - 1)) * plot.w;
}

/** One series' points on the plot, in category order; a gap stays `null`. */
export function linePoints(values: ReadonlyArray<number | null>, scale: Scale, plot: Plot): Array<Point | null> {
  return values.map((v, i) =>
    v == null ? null : { x: categoryX(i, values.length, plot), y: plot.y + (1 - position(v, scale)) * plot.h, i }
  );
}

/** An SVG path for the points: one stroke per unbroken run, so a gap breaks the line instead of bridging it. */
export function linePath(points: ReadonlyArray<Point | null>): string {
  let d = "";
  let pen = false;
  for (const p of points) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${r1(p.x)} ${r1(p.y)}`;
    pen = true;
  }
  return d;
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Which categories get an x label: all of them up to `max`, else every k-th from the first, evenly spaced. */
export function xTickIndexes(count: number, max = 6): number[] {
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const step = Math.ceil((count - 1) / (max - 1));
  const out: number[] = [];
  for (let i = 0; i < count; i += step) out.push(i);
  return out;
}

/**
 * Labels that would overlap, moved apart: each `y` keeps its order and ends at
 * least `gap` from its neighbours, inside `lo..hi` when that fits.
 */
export function spreadLabels(ys: readonly number[], gap: number, lo: number, hi: number): number[] {
  const order = ys.map((y, i) => i).sort((a, b) => ys[a] - ys[b]);
  const out = ys.slice();
  for (let k = 0; k < order.length; k++) {
    const i = order[k];
    out[i] = Math.max(out[i], lo, k > 0 ? out[order[k - 1]] + gap : -Infinity);
  }
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k];
    out[i] = Math.min(out[i], hi, k < order.length - 1 ? out[order[k + 1]] - gap : Infinity);
  }
  return out;
}

// ---- the chart's other readings

/** For each series, the category where it peaks (the first, on a tie), or null when it has no values. */
export function leaders(series: ReadonlyArray<AiChartSeries>): Array<number | null> {
  return series.map((s) => {
    let best: number | null = null;
    s.values.forEach((v, i) => {
      if (v != null && (best == null || v > (s.values[best] as number))) best = i;
    });
    return best;
  });
}

/** The chart as a table: x, then one column per series, a row per category in drawing order. */
export function chartTable(chart: AiChart): { columns: Array<{ key: string; label: string }>; rows: Array<Array<string | number | null>> } {
  return {
    columns: [{ key: chart.x.key, label: chart.x.label }, ...chart.series.map((s) => ({ key: s.key, label: s.label }))],
    rows: chart.categories.map((c, i) => [c, ...chart.series.map((s) => s.values[i] ?? null)]),
  };
}
