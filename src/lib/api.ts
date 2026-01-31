import { buildAuthHeaders, type GetTokenFn } from "./auth";
import {
  API_BASE,
  TEAMS_API,
  LINEUPS_API,
  RANKINGS_API,
  PLAYERS_API,
  MATCHUPS_API,
  STREAMERS_API,
  YAHOO_API,
} from "@/endpoints";
import type {
  Team,
  RosterPlayer,
  LeagueInfoRequest,
  TeamResponseData,
  TeamGetResponse,
  TeamAddResponse,
  TeamRemoveResponse,
  TeamUpdateResponse,
} from "@/types/team";
import type {
  Lineup,
  LineupGenerationRequest,
  LineupSaveRequest,
  GenerateLineupResponse,
  GetLineupsResponse,
  SaveLineupResponse,
  DeleteLineupResponse,
} from "@/types/lineup";
import type { RankingsPlayer } from "@/types/rankings";
import type { PlayerStats } from "@/types/player";
import type { BaseApiResponse } from "@/types/auth";
import type {
  MatchupData,
  MatchupResponse,
  AvgWindow,
  MatchupScoreHistory,
  MatchupScoreHistoryResponse,
} from "@/types/matchup";
import type { StreamerRequest, StreamerResponse } from "@/types/streamer";
import type {
  YahooAuthUrlResponse,
  YahooLeaguesResponse,
  YahooTeamsResponse,
  YahooLeague,
  YahooTeam,
} from "@/types/yahoo";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async authenticatedRequest<T>(
    url: string,
    getToken: GetTokenFn,
    options: RequestInit = {}
  ): Promise<T> {
    const authHeaders = await buildAuthHeaders(getToken);

    const response = await fetch(url, {
      ...options,
      headers: {
        ...authHeaders,
        ...options.headers,
      },
    });

    const data = await response.json();
    return data;
  }

  // Teams API - calls backend directly
  async getTeams(getToken: GetTokenFn): Promise<TeamResponseData[]> {
    const response = await this.authenticatedRequest<TeamGetResponse>(
      `${TEAMS_API}/`,
      getToken
    );
    if (response.status === "success" && response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to fetch teams");
  }

  async addTeam(
    getToken: GetTokenFn,
    teamData: LeagueInfoRequest
  ): Promise<TeamAddResponse> {
    const response = await this.authenticatedRequest<TeamAddResponse>(
      `${TEAMS_API}/add`,
      getToken,
      {
        method: "POST",
        body: JSON.stringify({ league_info: teamData }),
      }
    );
    return response;
  }

  async updateTeam(
    getToken: GetTokenFn,
    teamId: number,
    teamData: LeagueInfoRequest
  ): Promise<TeamUpdateResponse> {
    const response = await this.authenticatedRequest<TeamUpdateResponse>(
      `${TEAMS_API}/update`,
      getToken,
      {
        method: "PUT",
        body: JSON.stringify({ team_id: teamId, league_info: teamData }),
      }
    );
    return response;
  }

  async deleteTeam(
    getToken: GetTokenFn,
    teamId: number
  ): Promise<TeamRemoveResponse> {
    const response = await this.authenticatedRequest<TeamRemoveResponse>(
      `${TEAMS_API}/remove?team_id=${teamId}`,
      getToken,
      {
        method: "DELETE",
      }
    );
    return response;
  }

  async getTeamRoster(
    getToken: GetTokenFn,
    teamId: number
  ): Promise<RosterPlayer[]> {
    const response = await this.authenticatedRequest<
      BaseApiResponse<RosterPlayer[]>
    >(`${TEAMS_API}/view?team_id=${teamId}`, getToken);
    if (response.status === "success" && response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to fetch team roster");
  }

  // Lineups API - calls backend directly
  async getLineups(getToken: GetTokenFn, teamId: number): Promise<Lineup[]> {
    const response = await this.authenticatedRequest<GetLineupsResponse>(
      `${LINEUPS_API}?team_id=${teamId}`,
      getToken
    );
    if (response.status === "success" && response.data) {
      return response.data;
    }
    return [];
  }

  async generateLineup(
    getToken: GetTokenFn,
    data: LineupGenerationRequest
  ): Promise<GenerateLineupResponse> {
    const response = await this.authenticatedRequest<GenerateLineupResponse>(
      `${LINEUPS_API}/generate`,
      getToken,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return response;
  }

  async saveLineup(
    getToken: GetTokenFn,
    teamId: number,
    lineup: Lineup
  ): Promise<SaveLineupResponse> {
    const response = await this.authenticatedRequest<SaveLineupResponse>(
      `${LINEUPS_API}/save`,
      getToken,
      {
        method: "PUT",
        body: JSON.stringify({ team_id: teamId, lineup_info: lineup }),
      }
    );
    return response;
  }

  async deleteLineup(
    getToken: GetTokenFn,
    lineupId: number
  ): Promise<DeleteLineupResponse> {
    const response = await this.authenticatedRequest<DeleteLineupResponse>(
      `${LINEUPS_API}/remove?lineup_id=${lineupId}`,
      getToken,
      {
        method: "DELETE",
      }
    );
    return response;
  }

  // Matchups API
  async getMatchup(
    getToken: GetTokenFn,
    teamId: number,
    avgWindow: AvgWindow = "season"
  ): Promise<MatchupData> {
    const response = await this.authenticatedRequest<MatchupResponse>(
      `${MATCHUPS_API}/current/${teamId}?avg_window=${avgWindow}`,
      getToken
    );
    if (response.status === "success" && response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to fetch matchup data");
  }

  async getMatchupScoreHistory(
    getToken: GetTokenFn,
    teamId: number,
    matchupPeriod?: number
  ): Promise<MatchupScoreHistory | null> {
    const params = new URLSearchParams();
    if (matchupPeriod !== undefined) {
      params.append("matchup_period", matchupPeriod.toString());
    }
    const queryString = params.toString();
    const url = `${MATCHUPS_API}/history/${teamId}${queryString ? `?${queryString}` : ""}`;
    const response =
      await this.authenticatedRequest<MatchupScoreHistoryResponse>(
        url,
        getToken
      );
    if (response.status === "success" && response.data) {
      return response.data;
    }
    return null;
  }

  // Streamers API
  async findStreamers(
    getToken: GetTokenFn,
    request: StreamerRequest
  ): Promise<StreamerResponse> {
    const response = await this.authenticatedRequest<StreamerResponse>(
      `${STREAMERS_API}/find`,
      getToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }
    );
    return response;
  }

  // Yahoo API
  async getYahooAuthUrl(getToken: GetTokenFn): Promise<string> {
    const response = await this.authenticatedRequest<YahooAuthUrlResponse>(
      `${YAHOO_API}/authorize`,
      getToken
    );
    if (response.status === "success" && response.auth_url) {
      return response.auth_url;
    }
    throw new Error(response.message || "Failed to get Yahoo auth URL");
  }

  async getYahooLeagues(
    getToken: GetTokenFn,
    accessToken: string
  ): Promise<YahooLeague[]> {
    const response = await this.authenticatedRequest<YahooLeaguesResponse>(
      `${YAHOO_API}/leagues?access_token=${encodeURIComponent(accessToken)}`,
      getToken
    );
    if (response.status === "success" && response.leagues) {
      return response.leagues;
    }
    return [];
  }

  async getYahooTeams(
    getToken: GetTokenFn,
    accessToken: string,
    leagueKey: string
  ): Promise<YahooTeam[]> {
    const response = await this.authenticatedRequest<YahooTeamsResponse>(
      `${YAHOO_API}/teams?access_token=${encodeURIComponent(accessToken)}&league_key=${encodeURIComponent(leagueKey)}`,
      getToken
    );
    if (response.status === "success" && response.teams) {
      return response.teams;
    }
    return [];
  }

  // Rankings API (public - no auth required)
  async getRankings(): Promise<RankingsPlayer[]> {
    const response = await fetch(`${RANKINGS_API}/`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data: BaseApiResponse<RankingsPlayer[]> = await response.json();
    if (data.status === "success" && data.data) {
      return data.data;
    }
    return [];
  }

  // Players API (public - no auth required)
  async getPlayerStats(
    id: number,
    idType: "espn" | "nba" = "espn"
  ): Promise<PlayerStats | null> {
    const param = idType === "espn" ? "espn_id" : "player_id";
    const response = await fetch(`${PLAYERS_API}/stats?${param}=${id}`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data: BaseApiResponse<PlayerStats> = await response.json();
    if (data.status === "success" && data.data) {
      return data.data;
    }
    return null;
  }
}

// Create API client instance
export const apiClient = new ApiClient(API_BASE);
