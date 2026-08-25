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
  min_games: number | null;
}

export type RankingsWindow = 7 | 14 | 30 | null;

export interface RankingsParams {
  format: ScoringFormat;
  /** Rolling window in days; null = full season. */
  window: RankingsWindow;
  /** Category keys for format=categories; null = the backend's standard 9-cat. */
  categories: string[] | null;
  /** Games-played floor; null = the backend default for the window. */
  minGames: number | null;
}

export interface RankingsResult {
  players: RankingsPlayer[];
  meta: RankingsMeta | null;
}
