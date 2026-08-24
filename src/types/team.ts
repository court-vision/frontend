import type { ApiStatus, BaseApiResponse } from "./auth";

// Fantasy provider type
export type FantasyProvider = "espn" | "yahoo";

// League info structure (matches backend LeagueInfo)
export interface LeagueInfo {
  // Provider field - defaults to "espn" for backward compatibility
  provider?: FantasyProvider;

  // Common fields
  league_id: number;
  team_name: string;
  league_name?: string | null;
  year: number;

  // ESPN-specific fields
  espn_s2?: string | null;
  swid?: string | null;

  // Yahoo-specific fields
  yahoo_access_token?: string | null;
  yahoo_refresh_token?: string | null;
  yahoo_token_expiry?: string | null;
  yahoo_team_key?: string | null;
}

// Provider-detected league settings (matches backend LeagueSummary)
export type ScoringType = "points" | "categories" | "roto";

export interface CategoryDef {
  key: string;
  label: string;
  higher_is_better: boolean;
  is_rate: boolean;
}

export interface LeagueSummary {
  id: number;
  provider: FantasyProvider;
  provider_league_id: string;
  season: number;
  name?: string | null;
  scoring_type: ScoringType;
  category_win_mode?: "each_category" | "most_categories" | null;
  categories: CategoryDef[];
  point_weights: Record<string, number>;
  settings_synced: boolean;
  settings_synced_at?: string | null;
}

// Team response from backend (matches backend TeamResponse)
export interface TeamResponseData {
  team_id: number;
  league_info: LeagueInfo;
  league?: LeagueSummary | null; // null until league settings have been synced
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
  // Provider field - defaults to "espn" for backward compatibility
  provider?: FantasyProvider;

  // Common fields
  league_id: number;
  team_name: string;
  league_name?: string;
  year: number;

  // ESPN-specific fields
  espn_s2?: string;
  swid?: string;

  // Yahoo-specific fields
  yahoo_access_token?: string;
  yahoo_refresh_token?: string;
  yahoo_token_expiry?: string;
  yahoo_team_key?: string;
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
