/**
 * Scoring-format primitives shared by team, matchup, rankings, and insights types.
 *
 * Wire types are generated from the backend's OpenAPI schema (shim over
 * `src/types/generated/api.ts`; regenerate with `bun run generate:api`).
 * Rates (FG%, FT%) are always 0–1 fractions on the wire.
 *
 * The unions kept hand-written here (`ScoringFormat`, `ValueKind`,
 * `ValueSource`) are client-side vocabulary with no single backend schema to
 * generate from.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

/** Provider-detected league scoring type (as stored on `usr.leagues`). */
export type ScoringType = S["LeagueSummary"]["scoring_type"];

/** What the UI actually renders. Roto and unsynced leagues fall back to points. */
export type ScoringFormat = "points" | "categories";

/**
 * What a player's `avg_points` scalar means: fantasy points, or — for
 * H2H-category leagues — a "category value" proxy on the fpts scale
 * (≈25 for a pool-average player, ≈100 for a star). Default "fpts".
 */
export type ValueKind = "fpts" | "cat_value";

/** Where `avg_points` came from; "baseline" = last season's per-game line (no games this season yet). */
export type ValueSource = "rolling" | "recent" | "baseline";

export type CategoryWinMode = "each_category" | "most_categories";

export type CategoryDef = S["CategoryDefResp"];

export type CategoryWinner = S["CategoryScoreItem"]["winner"];

export type CategoryScoreItem = S["CategoryScoreItem"];

export type CategoryComparison = S["CategoryComparison"];

export type CategoryTeamScore = S["CategoryTeamScore"];

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
