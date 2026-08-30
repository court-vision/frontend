/**
 * Matchup types — generated from the backend's OpenAPI schema.
 *
 * Shim over `src/types/generated/api.ts`; regenerate with `bun run
 * generate:api`. `AvgWindow` is client-side vocabulary (it selects a query
 * param) and stays hand-written.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

// Player data within a matchup context (backend MatchupPlayerResp)
export type MatchupPlayer = S["MatchupPlayerResp"];

export type {
  ScoringFormat,
  CategoryScoreItem,
  CategoryComparison,
  CategoryTeamScore,
} from "./scoring";

// Team data within a matchup (backend MatchupTeamResp)
export type MatchupTeam = S["MatchupTeamResp"];

// Complete matchup data structure
export type MatchupData = S["MatchupData"];

// API Response type
export type MatchupResponse = S["MatchupResp"];

// Averaging window options
export type AvgWindow = "season" | "last_7" | "last_14" | "last_30";

// Daily score snapshot for chart visualization
export type DailyScorePoint = S["DailyScorePoint"];

// Historical score data for a matchup period
export type MatchupScoreHistory = S["MatchupScoreHistory"];

// API Response type for score history
export type MatchupScoreHistoryResponse = S["MatchupScoreHistoryResp"];

// ---- Live matchup types ----

export type PlayerLiveStats = S["PlayerLiveStats"];

export type LiveMatchupPlayer = S["LiveMatchupPlayer"];

export type LiveMatchupTeam = S["LiveMatchupTeam"];

export type LiveMatchupData = S["LiveMatchupData"];

export type LiveMatchupResponse = S["LiveMatchupResp"];

// ---- Daily matchup types (day-by-day navigation) ----

export type DailyMatchupPlayerStats = S["DailyMatchupPlayerStats"];

export type DailyMatchupFuturePlayer = S["DailyMatchupFuturePlayer"];

export type DailyMatchupTeam = S["DailyMatchupTeam"];

export type DailyMatchupData = S["DailyMatchupData"];

export type DailyMatchupResponse = S["DailyMatchupResp"];

// ---- Weekly matchup types (full period in one request) ----

export type WeeklyMatchupData = S["WeeklyMatchupData"];

export type WeeklyMatchupResponse = S["WeeklyMatchupResp"];

// ---- Season summary types ----

export type WeekResult = S["WeekResult"];

export type SeasonSummaryData = S["SeasonSummaryData"];

export type SeasonSummaryResponse = S["SeasonSummaryResp"];
