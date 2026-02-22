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

// Team data within a matchup
export interface MatchupTeam {
  team_name: string;
  team_id: number; // ESPN fantasy team ID
  current_score: number; // Points scored so far this matchup period
  projected_score: number; // Projected final score for matchup period
  roster: MatchupPlayer[];
}

// Complete matchup data structure
export interface MatchupData {
  matchup_period: number; // Week/matchup period number
  matchup_period_start: string; // ISO date string
  matchup_period_end: string; // ISO date string
  your_team: MatchupTeam;
  opponent_team: MatchupTeam;
  projected_winner: string; // Team name of projected winner
  projected_margin: number; // Projected point differential
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
}

export type LiveMatchupResponse = BaseApiResponse<LiveMatchupData>;
