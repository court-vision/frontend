/**
 * Rankings query parameters: URL <-> params <-> API query. Pure.
 *
 * URL keys: `format`, `window`, `cats` (csv), `min_games`. Defaults are
 * omitted from the URL so `/rankings` stays canonical for the points view.
 */

import type { RankingsParams, RankingsWindow } from "@/types/rankings";
import type { ScoringFormat } from "@/types/scoring";

export const RANKINGS_WINDOWS: { value: RankingsWindow; label: string; long: string }[] = [
  { value: null, label: "Season", long: "Full season" },
  { value: 30, label: "L30", long: "Last 30 days" },
  { value: 14, label: "L14", long: "Last 14 days" },
  { value: 7, label: "L7", long: "Last 7 days" },
];

/**
 * Games-played floor per window. The backend applies no floor by default —
 * rankings show the new season from day 1 — so `min_games` is an explicit
 * opt-in filter and every default is 1.
 */
export const DEFAULT_MIN_GAMES: Record<string, number> = { season: 1, "30": 1, "14": 1, "7": 1 };

/** Category keys the backend can rank (services/scoring/category_rank.RANKABLE_KEYS). */
export const RANKABLE_KEYS = [
  "pts", "reb", "ast", "stl", "blk", "tov",
  "fgm", "fga", "fg_pct", "ftm", "fta", "ft_pct",
  "fg3m", "fg3a", "fg3_pct",
] as const;

export const STANDARD_9CAT_KEYS = ["fg_pct", "ft_pct", "fg3m", "pts", "reb", "ast", "stl", "blk", "tov"];

export const DEFAULT_RANKINGS_PARAMS: RankingsParams = {
  format: "points",
  window: null,
  categories: null,
  minGames: null,
};

function isWindow(v: number): v is 7 | 14 | 30 {
  return v === 7 || v === 14 || v === 30;
}

export function windowLabel(window: RankingsWindow): string {
  return RANKINGS_WINDOWS.find((w) => w.value === window)?.label ?? "Season";
}

export function defaultMinGames(window: RankingsWindow): number {
  return DEFAULT_MIN_GAMES[window === null ? "season" : String(window)] ?? 1;
}

/** Keep only rankable keys, deduped, in order; empty → null. */
export function rankableCategories(keys: string[] | null | undefined): string[] | null {
  if (!keys) return null;
  const out: string[] = [];
  for (const k of keys) {
    const key = k.trim().toLowerCase();
    if ((RANKABLE_KEYS as readonly string[]).includes(key) && !out.includes(key)) out.push(key);
  }
  return out.length ? out : null;
}

export function isStandard9Cat(keys: string[] | null): boolean {
  if (!keys || keys.length !== STANDARD_9CAT_KEYS.length) return false;
  const a = [...keys].sort().join(",");
  const b = [...STANDARD_9CAT_KEYS].sort().join(",");
  return a === b;
}

export function normalizeParams(p: Partial<RankingsParams> | null | undefined): RankingsParams {
  const format: ScoringFormat = p?.format === "categories" ? "categories" : "points";
  const window: RankingsWindow =
    typeof p?.window === "number" && isWindow(p.window) ? p.window : null;
  const categories = format === "categories" ? rankableCategories(p?.categories) : null;
  const minGames =
    format === "categories" && typeof p?.minGames === "number" && Number.isFinite(p.minGames)
      ? Math.min(82, Math.max(1, Math.round(p.minGames)))
      : null;
  return { format, window, categories, minGames };
}

type SearchLike = URLSearchParams | Record<string, string | string[] | undefined> | string;

function getParam(sp: SearchLike, key: string): string | null {
  if (typeof sp === "string") return new URLSearchParams(sp).get(key);
  if (sp instanceof URLSearchParams) return sp.get(key);
  const v = sp[key];
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

/** Only the keys present in the URL (so league defaults can fill the rest). */
export function parseRankingsSearchParams(sp: SearchLike): Partial<RankingsParams> {
  const out: Partial<RankingsParams> = {};
  const format = getParam(sp, "format");
  if (format === "points" || format === "categories") out.format = format;
  const window = getParam(sp, "window");
  if (window !== null) {
    const n = Number(window);
    out.window = isWindow(n) ? n : null;
  }
  const cats = getParam(sp, "cats");
  if (cats !== null) out.categories = rankableCategories(cats.split(","));
  const min = getParam(sp, "min_games");
  if (min !== null && min !== "") out.minGames = Number(min);
  return out;
}

export function hasFormatParam(sp: SearchLike): boolean {
  return getParam(sp, "format") !== null;
}

/** URL query for these params, omitting defaults. Empty string for the canonical points view. */
export function toSearchString(p: RankingsParams): string {
  const q = new URLSearchParams();
  if (p.format !== "points") q.set("format", p.format);
  if (p.window !== null) q.set("window", String(p.window));
  if (p.format === "categories" && p.categories && !isStandard9Cat(p.categories)) {
    q.set("cats", p.categories.join(","));
  }
  if (p.format === "categories" && p.minGames !== null) q.set("min_games", String(p.minGames));
  return q.toString();
}

/** Backend query string for these params. */
export function toApiQuery(p: RankingsParams): string {
  const q = new URLSearchParams();
  if (p.window !== null) q.set("window", String(p.window));
  if (p.format === "categories") {
    q.set("format", "categories");
    if (p.categories?.length) q.set("categories", p.categories.join(","));
    if (p.minGames !== null) q.set("min_games", String(p.minGames));
  }
  return q.toString();
}

/** Stable identity for query keys. */
export function paramsKey(p: RankingsParams): string {
  return toApiQuery(p) || "season-points";
}
