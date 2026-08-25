import type { ApiStatus, BaseApiResponse } from "./auth";

// Fantasy provider type
export type FantasyProvider = "espn" | "yahoo";

/** Per-team override of the rendered scoring format (e.g. view a points league as 9-cat). */
export type ScoringPreview = "points" | "categories";

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

  // View this team as a different format than its league uses; null = the league's real format
  scoring_preview?: ScoringPreview | null;
}

// Provider-detected league settings (matches backend LeagueSummary)
import type { ScoringType, CategoryDef, CategoryWinMode, ValueKind, ValueSource } from "./scoring";

export type { ScoringType, CategoryDef, CategoryWinMode } from "./scoring";

export interface LeagueSummary {
  id: number;
  provider: FantasyProvider;
  provider_league_id: string;
  season: number;
  name?: string | null;
  scoring_type: ScoringType;
  category_win_mode?: CategoryWinMode | null;
  categories: CategoryDef[];
  point_weights: Record<string, number>;
  settings_synced: boolean;
  settings_synced_at?: string | null;
  /** Set when the team's scoring_preview overrides the league's real format above. */
  scoring_preview?: ScoringPreview | null;
}

// Full league detail (matches backend LeagueDetail, GET /teams/{id}/league)
export interface LeagueDetail extends LeagueSummary {
  matchup_periods: Record<string, unknown>;
  roster_slots: Record<string, number>;
  unsupported: string[];
  warnings: string[];
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
  /** Fantasy points per game, or a category value when `value_kind` is "cat_value". */
  avg_points: number;
  team: string;
  valid_positions: string[];
  injured: boolean;
  /** Absent on older API builds → fpts. */
  value_kind?: ValueKind;
  value_source?: ValueSource | null;
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

  scoring_preview?: ScoringPreview;
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
export type LeagueGetResponse = BaseApiResponse<LeagueDetail | null>;
export type LeagueSyncResponse = BaseApiResponse<LeagueSummary | null>;
