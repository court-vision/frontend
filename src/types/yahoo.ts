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

// Temporary OAuth state stored in component during flow
export interface YahooOAuthState {
  /**
   * Opaque, user-scoped handle to credentials the server stored during the
   * OAuth callback. The browser never receives Yahoo tokens — they used to
   * arrive as query parameters, which put long-lived refresh tokens into
   * browser history, the Referer header, and every log on the path.
   */
  connectionId: number;
  selectedLeague: YahooLeague | null;
  selectedTeam: YahooTeam | null;
}
