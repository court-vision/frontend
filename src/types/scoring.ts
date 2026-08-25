/**
 * Scoring-format primitives shared by team, matchup, rankings, and insights types.
 *
 * Mirrors backend `services/scoring/models.py` and `schemas/common.py`.
 * Rates (FG%, FT%) are always 0–1 fractions on the wire.
 */

/** Provider-detected league scoring type (as stored on `usr.leagues`). */
export type ScoringType = "points" | "categories" | "roto";

/** What the UI actually renders. Roto and unsynced leagues fall back to points. */
export type ScoringFormat = "points" | "categories";

export type CategoryWinMode = "each_category" | "most_categories";

export interface CategoryDef {
  key: string;
  label: string;
  higher_is_better: boolean;
  is_rate: boolean;
}

export type CategoryWinner = "you" | "opp" | "tie";

export interface CategoryScoreItem {
  key: string;
  label: string;
  you: number;
  opp: number;
  winner: CategoryWinner;
  higher_is_better: boolean;
  is_rate: boolean;
}

export interface CategoryComparison {
  items: CategoryScoreItem[];
  wins: number;
  losses: number;
  ties: number;
}

export interface CategoryTeamScore {
  totals: Record<string, number>; // rates are 0-1 fractions
  raw?: Record<string, number> | null; // makes/attempts and other raw inputs
  wins: number;
  losses: number;
  ties: number;
  live_adjusted: boolean;
}

/**
 * Resolve the format the UI should render, mirroring the backend resolver:
 * only a synced categories league renders as categories; roto and unsynced
 * leagues render the points view.
 */
export function toScoringFormat(
  type: ScoringType | null | undefined,
  synced: boolean | null | undefined
): ScoringFormat {
  if (!synced) return "points";
  return type === "categories" ? "categories" : "points";
}
