import type { ApiStatus, BaseApiResponse } from "./auth";

// League info structure (matches backend LeagueInfo)
export interface LeagueInfo {
  league_id: number;
  espn_s2?: string | null;
  swid?: string | null;
  team_name: string;
  league_name?: string | null;
  year: number;
}

// Team response from backend (matches backend TeamResponse)
export interface TeamResponseData {
  team_id: number;
  league_info: LeagueInfo;
}

// Legacy interface for backwards compatibility
export interface TeamInfo {
  team_name: string;
  league_name: string;
  league_id: number;
  year: number;
  espn_s2?: string;
  swid?: string;
}

export interface Team {
  team_id: number;
  team_info: TeamInfo;
}

export interface RosterPlayer {
  player_id: number;
  name: string;
  avg_points: number;
  team: string;
  valid_positions: string[];
  injured: boolean;
}

export interface LeagueInfoRequest {
  league_id: number;
  espn_s2?: string;
  swid?: string;
  team_name: string;
  league_name?: string;
  year: number;
}

// Backend API Response Types
export type TeamGetResponse = BaseApiResponse<TeamResponseData[]>;
export type TeamAddResponse = BaseApiResponse<TeamResponseData> & {
  team_id?: number | null;
  already_exists?: boolean;
};
export type TeamRemoveResponse = BaseApiResponse<number>;
export type TeamUpdateResponse = BaseApiResponse<TeamResponseData>;
export type TeamViewResponse = BaseApiResponse<TeamResponseData>;
