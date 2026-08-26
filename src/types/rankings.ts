import type { CategoryDef, ScoringFormat } from "./scoring";

export interface RankingsPlayer {
  id: number;
  rank: number;
  player_name: string;
  team: string;
  total_fpts: number;
  avg_fpts: number;
  rank_change: number;
  // format=categories only (null/absent for points rankings)
  gp?: number | null;
  /** Per-game value per category; rates are 0-1 fractions (null when no attempts). */
  categories?: Record<string, number | null> | null;
  /** Signed z-score per category over the ranked pool (positive is always good). */
  category_z?: Record<string, number> | null;
  /** Sum of category z-scores; the ranking key for format=categories. */
  score?: number | null;
}

export interface RankingsMeta {
  format: ScoringFormat;
  window: number | null;
  as_of: string | null;
  categories: CategoryDef[];
  pool_size: number;
  /** Games-played floor applied; 1 unless the caller set `min_games`. */
  min_games: number | null;
  /** Season key, e.g. "2026-27". */
  season: string;
  /** Day of the regular season the data is as of; null before opening night. */
  season_day: number | null;
  /** Most games any player in the pool has played in the window; null before opening night. */
  max_gp: number | null;
}

export type RankingsWindow = 7 | 14 | 30 | null;

export interface RankingsParams {
  format: ScoringFormat;
  /** Rolling window in days; null = full season. */
  window: RankingsWindow;
  /** Category keys for format=categories; null = the backend's standard 9-cat. */
  categories: string[] | null;
  /** Games-played floor; null = no floor (the backend applies none by default). */
  minGames: number | null;
}

export interface RankingsResult {
  players: RankingsPlayer[];
  meta: RankingsMeta | null;
  /** Backend message; explains an empty `players` list (e.g. before opening night). */
  message: string;
}
