/**
 * Yahoo Fantasy API types
 */

export interface YahooLeague {
  league_key: string;
  league_id: string;
  name: string;
  season: string;
  num_teams: number;
  scoring_type: string;
}

export interface YahooTeam {
  team_key: string;
  team_id: string;
  name: string;
  is_owned_by_current_login: boolean;
}

export interface YahooAuthUrlResponse {
  status: "success" | "error";
  message: string;
  auth_url: string | null;
}

export interface YahooLeaguesResponse {
  status: "success" | "error";
  message: string;
  leagues: YahooLeague[] | null;
}

export interface YahooTeamsResponse {
  status: "success" | "error";
  message: string;
  teams: YahooTeam[] | null;
}

export interface YahooTokenResponse {
  status: "success" | "error";
  message: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: string | null;
}

// Temporary OAuth state stored in component during flow
export interface YahooOAuthState {
  accessToken: string;
  refreshToken: string;
  tokenExpiry: string;
  selectedLeague?: YahooLeague | null;
  selectedTeam?: YahooTeam | null;
}
