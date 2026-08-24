import type { BaseApiResponse } from "./auth";

// Player data within a matchup context
export interface MatchupPlayer {
  player_id: number;
  name: string;
  team: string; // NBA team abbreviation
  position: string; // Primary position (PG, SG, etc.)
  lineup_slot: string; // Current lineup slot (PG, SG, BE, IR, etc.)
  avg_points: number; // Average points based on selected window
  projected_points: number; // ESPN's projected points
  games_remaining: number; // Games left in matchup period
  injured: boolean;
  injury_status: string | null;
}

// ---- Category scoring (category leagues only; absent for points leagues) ----

export type ScoringFormat = "points" | "categories";

export interface CategoryScoreItem {
  key: string;
  label: string;
  you: number;
  opp: number;
  winner: "you" | "opp" | "tie";
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
  raw?: Record<string, number> | null;
  wins: number;
  losses: number;
  ties: number;
  live_adjusted: boolean;
}

// Team data within a matchup
export interface MatchupTeam {
  team_name: string;
  team_id: number; // ESPN fantasy team ID
  current_score: number; // Points scored so far this matchup period
  projected_score: number; // Projected final score for matchup period
  roster: MatchupPlayer[];
  categories?: CategoryTeamScore | null;
}

// Complete matchup data structure
export interface MatchupData {
  matchup_period: number; // Week/matchup period number
  matchup_period_start: string; // ISO date string
  matchup_period_end: string; // ISO date string
  your_team: MatchupTeam;
  opponent_team: MatchupTeam;
  projected_winner: string; // Team name of projected winner
  projected_margin: number; // Projected point differential (categories: won - lost)
  scoring_format?: ScoringFormat;
  settings_synced?: boolean;
  category_comparison?: CategoryComparison | null;
  projected_category_comparison?: CategoryComparison | null;
}

// API Response type
export type MatchupResponse = BaseApiResponse<MatchupData>;

// Averaging window options
export type AvgWindow = "season" | "last_7" | "last_14" | "last_30";

// Daily score snapshot for chart visualization
export interface DailyScorePoint {
  date: string; // ISO date string
  day_of_matchup: number; // 0-indexed day within matchup
  your_score: number;
  opponent_score: number;
}

// Historical score data for a matchup period
export interface MatchupScoreHistory {
  team_id: number;
  team_name: string;
  opponent_team_name: string;
  matchup_period: number;
  history: DailyScorePoint[];
}

// API Response type for score history
export type MatchupScoreHistoryResponse = BaseApiResponse<MatchupScoreHistory>;

// ---- Live matchup types ----

export interface PlayerLiveStats {
  nba_player_id: number;
  live_fpts: number;
  live_pts: number;
  live_reb: number;
  live_ast: number;
  live_stl: number;
  live_blk: number;
  live_tov: number;
  live_min: number;
  live_fgm?: number;
  live_fga?: number;
  live_fg3m?: number;
  live_fg3a?: number;
  live_ftm?: number;
  live_fta?: number;
  game_status: number; // 1=scheduled, 2=in_progress, 3=final
  period: number | null;
  game_clock: string | null;
  last_updated: string | null;
}

export interface LiveMatchupPlayer extends MatchupPlayer {
  live: PlayerLiveStats | null;
}

export interface LiveMatchupTeam {
  team_name: string;
  team_id: number;
  current_score: number;
  projected_score: number;
  roster: LiveMatchupPlayer[];
  categories?: CategoryTeamScore | null;
}

export interface LiveMatchupData {
  matchup_period: number;
  matchup_period_start: string;
  matchup_period_end: string;
  your_team: LiveMatchupTeam;
  opponent_team: LiveMatchupTeam;
  projected_winner: string;
  projected_margin: number;
  game_date: string;
  scoring_format?: ScoringFormat;
  settings_synced?: boolean;
  category_comparison?: CategoryComparison | null;
}

export type LiveMatchupResponse = BaseApiResponse<LiveMatchupData>;

// ---- Daily matchup types (day-by-day navigation) ----

export interface DailyMatchupPlayerStats {
  player_id: number;
  name: string;
  team: string;
  position: string;
  nba_player_id: number | null;
  had_game: boolean;
  fpts: number | null;
  pts: number | null;
  reb: number | null;
  ast: number | null;
  stl: number | null;
  blk: number | null;
  tov: number | null;
  min: number | null;
  fgm: number | null;
  fga: number | null;
  fg3m: number | null;
  fg3a: number | null;
  ftm: number | null;
  fta: number | null;
}

export interface DailyMatchupFuturePlayer {
  player_id: number;
  name: string;
  team: string;
  position: string;
  has_game: boolean;
  opponent: string | null;
  game_time_et: string | null;
  injured: boolean;
  injury_status: string | null;
}

export interface DailyMatchupTeam {
  team_name: string;
  team_id: number;
  total_fpts: number | null;
  roster: DailyMatchupPlayerStats[] | DailyMatchupFuturePlayer[];
  categories?: Record<string, number> | null;
}

export interface DailyMatchupData {
  date: string;
  day_type: "past" | "today" | "future";
  day_of_week: string;
  day_index: number;
  matchup_period: number;
  matchup_period_start: string;
  matchup_period_end: string;
  your_team: DailyMatchupTeam;
  opponent_team: DailyMatchupTeam;
  scoring_format?: ScoringFormat;
  category_comparison?: CategoryComparison | null;
}

export type DailyMatchupResponse = BaseApiResponse<DailyMatchupData>;

// ---- Weekly matchup types (full period in one request) ----

export interface WeeklyMatchupData {
  matchup_period: number;
  days: DailyMatchupData[];
}

export type WeeklyMatchupResponse = BaseApiResponse<WeeklyMatchupData>;

// ---- Season summary types ----

export interface WeekResult {
  matchup_period: number;
  opponent_team_name: string;
  points_for: number;
  points_against: number;
  won: boolean;
  categories_won?: number | null;
  categories_lost?: number | null;
  categories_tied?: number | null;
}

export interface SeasonSummaryData {
  team_id: number;
  team_name: string;
  wins: number;
  losses: number;
  total_points_for: number;
  total_points_against: number;
  best_week: WeekResult | null;
  worst_week: WeekResult | null;
  weeks: WeekResult[];
  scoring_format?: ScoringFormat;
}

export type SeasonSummaryResponse = BaseApiResponse<SeasonSummaryData>;
