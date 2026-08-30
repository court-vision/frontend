/**
 * Rankings types.
 *
 * Wire types are generated from the backend's OpenAPI schema (shim over
 * `src/types/generated/api.ts`; regenerate with `bun run generate:api`).
 * The params/scope types below are client-side only — they configure which
 * endpoint and query string the hooks build, and have no backend mirror.
 *
 * Note `RankingsMeta.season` (and most meta fields) are optional-nullable in
 * the generated shape: the hand-written predecessor declared `season: string`
 * required, which the backend never promised — pydantic has it
 * `Optional[str] = None`.
 */
import type { components } from "./generated/api";
import type { ScoringFormat } from "./scoring";

type S = components["schemas"];

export type RankingsPlayer = S["RankingsPlayer"];
export type RankingsScoring = S["RankingsScoring"];
export type RankingsMeta = S["RankingsMeta"];

/**
 * Which pool scoring to rank by: the platform default, or the selected team's
 * league settings. Not an API query param — it picks the endpoint.
 */
export type RankingsScope = "global" | "league";

export type RankingsWindow = 7 | 14 | 30 | null;

export interface RankingsParams {
  /** `league` requires a selected team; `useRankingsParams` downgrades it otherwise. */
  scope: RankingsScope;
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
