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
