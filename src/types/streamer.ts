import type { BaseApiResponse } from "./auth";
import type { LeagueInfo } from "./team";

// Streamer player from backend response
export interface StreamerPlayer {
  player_id: number;
  name: string;
  team: string;
  valid_positions: string[];
  avg_points_last_n: number | null;
  avg_points_season: number;
  games_remaining: number;
  has_b2b: boolean;
  b2b_game_count: number;
  game_days: number[];
  streamer_score: number;
  injured: boolean;
  injury_status: string | null;
}

// Streamer data from backend response
export interface StreamerData {
  matchup_number: number;
  current_day_index: number;
  game_span: number;
  avg_days: number;
  teams_with_b2b: string[];
  streamers: StreamerPlayer[];
}

// Request to find streamers
export interface StreamerRequest {
  league_info: LeagueInfo;
  fa_count?: number;
  exclude_injured?: boolean;
  b2b_only?: boolean;
  day?: number | null;
  avg_days?: number;
}

// Backend API Response Type
export type StreamerResponse = BaseApiResponse<StreamerData>;
