import { buildAuthHeaders, type GetTokenFn } from "./auth";
import {
  API_BASE,
  LIVE_API,
  TEAMS_API,
  LINEUPS_API,
  RANKINGS_API,
  PLAYERS_API,
  MATCHUPS_API,
  STREAMERS_API,
  YAHOO_API,
  GAMES_API,
  OWNERSHIP_API,
  SCHEDULE_API,
  NOTIFICATIONS_API,
  API_KEYS_API,
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
  ScheduleWeeksData,
  ScheduleWeeksResponse,
} from "@/types/lineup";
import type { RankingsPlayer } from "@/types/rankings";
import type { PlayerStats, PercentileData, PlayerStatusData, PlayerOwnershipData } from "@/types/player";
import type { BaseApiResponse } from "@/types/auth";
import type { GamesOnDateData, TeamScheduleData, NBATeamLiveGameData } from "@/types/games";
import type { NBATeamStatsData, NBATeamRosterData } from "@/types/nba-team";
import type {
  MatchupData,
  MatchupResponse,
  AvgWindow,
  MatchupScoreHistory,
  MatchupScoreHistoryResponse,
  LiveMatchupData,
  LiveMatchupResponse,
  DailyMatchupData,
  DailyMatchupResponse,
  WeeklyMatchupData,
  WeeklyMatchupResponse,
} from "@/types/matchup";
import type { StreamerRequest, StreamerResponse } from "@/types/streamer";
import type {
  YahooAuthUrlResponse,
  YahooLeaguesResponse,
  YahooTeamsResponse,
  YahooLeague,
  YahooTeam,
} from "@/types/yahoo";
import type {
  OwnershipTrendingData,
  OwnershipTrendingResponse,
  OwnershipTrendingParams,
} from "@/types/ownership";
import type {
  ApiKeyListItem,
  ApiKeyListResponse,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
} from "@/types/api-keys";
import type { BreakoutData, BreakoutResponse } from "@/types/breakout";
import type { LivePlayersData, LivePlayersResponse } from "@/types/live";
import type {
  NotificationPreference,
  NotificationPreferenceResponse,
  NotificationTeamPreference,
  NotificationTeamPreferenceRequest,
  NotificationTeamPreferenceListResponse,
  NotificationTeamPreferenceSingleResponse,
} from "@/types/notifications";
import type {
  TeamInsightsData,
  TeamInsightsResponse,
} from "@/types/team-insights";

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

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.message ||
          `Request failed: ${response.status} ${response.statusText}`
      );
    }

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

  async getTeamInsights(
    getToken: GetTokenFn,
    teamId: number
  ): Promise<TeamInsightsData> {
    const response = await this.authenticatedRequest<TeamInsightsResponse>(
      `${TEAMS_API}/${teamId}/insights`,
      getToken
    );
    if (response.status === "success" && response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to fetch team insights");
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

  async getLiveMatchup(
    getToken: GetTokenFn,
    teamId: number
  ): Promise<LiveMatchupData> {
    const response = await this.authenticatedRequest<LiveMatchupResponse>(
      `${MATCHUPS_API}/live/${teamId}`,
      getToken
    );
    if (response.status === "success" && response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to fetch live matchup data");
  }

  async getDailyMatchup(
    getToken: GetTokenFn,
    teamId: number,
    date: string
  ): Promise<DailyMatchupData> {
    const response = await this.authenticatedRequest<DailyMatchupResponse>(
      `${MATCHUPS_API}/daily/${teamId}?date=${date}`,
      getToken
    );
    if (response.status === "success" && response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to fetch daily matchup data");
  }

  async getWeeklyMatchup(
    getToken: GetTokenFn,
    teamId: number
  ): Promise<WeeklyMatchupData> {
    const response = await this.authenticatedRequest<WeeklyMatchupResponse>(
      `${MATCHUPS_API}/week/${teamId}`,
      getToken
    );
    if (response.status === "success" && response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to fetch weekly matchup data");
  }

  // Breakout Streamers API (internal, Clerk auth)
  async getBreakoutStreamers(
    getToken: GetTokenFn,
    limit: number = 30,
    team?: string
  ): Promise<BreakoutData | null> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (team) params.set("team", team);
    const response = await this.authenticatedRequest<BreakoutResponse>(
      `${STREAMERS_API}/breakout?${params}`,
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

  // Notifications API
  async getNotificationPreferences(
    getToken: GetTokenFn
  ): Promise<NotificationPreference> {
    const response =
      await this.authenticatedRequest<NotificationPreferenceResponse>(
        `${NOTIFICATIONS_API}/preferences`,
        getToken
      );
    if (response.status === "success" && response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to fetch notification preferences");
  }

  async updateNotificationPreferences(
    getToken: GetTokenFn,
    data: NotificationPreference
  ): Promise<NotificationPreference> {
    const response =
      await this.authenticatedRequest<NotificationPreferenceResponse>(
        `${NOTIFICATIONS_API}/preferences`,
        getToken,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
    if (response.status === "success" && response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to update notification preferences");
  }

  async getTeamNotificationPreferences(
    getToken: GetTokenFn
  ): Promise<NotificationTeamPreference[]> {
    const response = await this.authenticatedRequest<NotificationTeamPreferenceListResponse>(
      `${NOTIFICATIONS_API}/team-preferences`,
      getToken
    );
    if (response.status === "success" && response.data) {
      return response.data;
    }
    return [];
  }

  async upsertTeamNotificationPreference(
    getToken: GetTokenFn,
    teamId: number,
    data: NotificationTeamPreferenceRequest
  ): Promise<NotificationTeamPreference> {
    const response = await this.authenticatedRequest<NotificationTeamPreferenceSingleResponse>(
      `${NOTIFICATIONS_API}/team-preferences/${teamId}`,
      getToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    if (response.status === "success" && response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to update team notification preferences");
  }

  async deleteTeamNotificationPreference(
    getToken: GetTokenFn,
    teamId: number
  ): Promise<void> {
    await this.authenticatedRequest<{ status: string }>(
      `${NOTIFICATIONS_API}/team-preferences/${teamId}`,
      getToken,
      { method: "DELETE" }
    );
  }

  // Live API (public - no auth required)
  async getLivePlayersToday(): Promise<LivePlayersData> {
    const response = await fetch(`${LIVE_API}/players/today`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data: LivePlayersResponse = await response.json();
    if (data.status === "success" && data.data) {
      return data.data;
    }
    throw new Error(data.message || "Failed to fetch live players");
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
    idType: "espn" | "nba" = "espn",
    window: string = "season"
  ): Promise<PlayerStats | null> {
    const param = idType === "espn" ? "espn_id" : "player_id";
    const searchParams = new URLSearchParams({ [param]: id.toString() });
    if (window !== "season") {
      searchParams.append("window", window);
    }
    const response = await fetch(`${PLAYERS_API}/stats?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data: BaseApiResponse<PlayerStats> = await response.json();
    if (data.status === "success" && data.data) {
      return data.data;
    }
    return null;
  }

  async getPlayerStatsByName(
    name: string,
    team: string,
    window: string = "season"
  ): Promise<PlayerStats | null> {
    const params = new URLSearchParams({ name, team });
    if (window !== "season") {
      params.append("window", window);
    }
    const response = await fetch(`${PLAYERS_API}/stats?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data: BaseApiResponse<PlayerStats> = await response.json();
    if (data.status === "success" && data.data) {
      return data.data;
    }
    return null;
  }

  async getPlayerPercentiles(
    playerId: number,
    minGames: number = 20
  ): Promise<PercentileData | null> {
    const params = new URLSearchParams();
    if (minGames !== 20) {
      params.append("min_games", minGames.toString());
    }
    const queryString = params.toString();
    const url = `${PLAYERS_API}/${playerId}/percentiles${queryString ? `?${queryString}` : ""}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data: BaseApiResponse<PercentileData> = await response.json();
    if (data.status === "success" && data.data) {
      return data.data;
    }
    return null;
  }

  async getPlayerStatus(playerId: number): Promise<PlayerStatusData | null> {
    const response = await fetch(`${PLAYERS_API}/${playerId}/status`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data: BaseApiResponse<PlayerStatusData> = await response.json();
    if (data.status === "success" && data.data) {
      return data.data;
    }
    return null;
  }

  async getPlayerOwnership(playerId: number, days: number = 14): Promise<PlayerOwnershipData | null> {
    const params = days !== 14 ? `?days=${days}` : "";
    const response = await fetch(`${PLAYERS_API}/${playerId}/ownership${params}`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data: BaseApiResponse<PlayerOwnershipData> = await response.json();
    if (data.status === "success" && data.data) {
      return data.data;
    }
    return null;
  }

  async getTeamSchedule(teamAbbrev: string, upcoming: boolean = false, limit: number = 12): Promise<TeamScheduleData | null> {
    const params = new URLSearchParams();
    if (upcoming) params.append("upcoming", "true");
    if (limit !== 20) params.append("limit", limit.toString());
    const queryString = params.toString();
    const url = `${API_BASE}/v1/teams/${teamAbbrev}/schedule${queryString ? `?${queryString}` : ""}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data: BaseApiResponse<TeamScheduleData> = await response.json();
    if (data.status === "success" && data.data) {
      return data.data;
    }
    return null;
  }

  async getNBATeamStats(abbrev: string): Promise<NBATeamStatsData | null> {
    const response = await fetch(`${API_BASE}/v1/teams/${abbrev}/stats`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data: BaseApiResponse<NBATeamStatsData> = await response.json();
    if (data.status === "success" && data.data) {
      return data.data;
    }
    return null;
  }

  async getNBATeamRoster(abbrev: string): Promise<NBATeamRosterData | null> {
    const response = await fetch(`${API_BASE}/v1/teams/${abbrev}/roster`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data: BaseApiResponse<NBATeamRosterData> = await response.json();
    if (data.status === "success" && data.data) {
      return data.data;
    }
    return null;
  }

  async getNBATeamLiveGame(abbrev: string): Promise<NBATeamLiveGameData | null> {
    const response = await fetch(`${API_BASE}/v1/teams/${abbrev}/live-game`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data: BaseApiResponse<NBATeamLiveGameData> = await response.json();
    if (data.status === "success" && data.data) {
      return data.data;
    }
    return null;
  }

  // Games API (public - no auth required)
  async getGamesOnDate(date: string): Promise<GamesOnDateData | null> {
    const response = await fetch(`${GAMES_API}/${date}`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data: BaseApiResponse<GamesOnDateData> = await response.json();
    if (data.status === "success" && data.data) {
      return data.data;
    }
    return null;
  }

  // Schedule API (public - no auth required)
  async getScheduleWeeks(): Promise<ScheduleWeeksData | null> {
    const response = await fetch(`${SCHEDULE_API}/weeks`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data: ScheduleWeeksResponse = await response.json();
    if (data.status === "success" && data.data) {
      return data.data;
    }
    return null;
  }

  // Ownership API (public - no auth required)
  async getOwnershipTrending(
    params: OwnershipTrendingParams = {}
  ): Promise<OwnershipTrendingData | null> {
    const searchParams = new URLSearchParams();
    if (params.days !== undefined)
      searchParams.append("days", params.days.toString());
    if (params.min_change !== undefined)
      searchParams.append("min_change", params.min_change.toString());
    if (params.min_ownership !== undefined)
      searchParams.append("min_ownership", params.min_ownership.toString());
    if (params.sort_by !== undefined)
      searchParams.append("sort_by", params.sort_by);
    if (params.direction !== undefined)
      searchParams.append("direction", params.direction);
    if (params.limit !== undefined)
      searchParams.append("limit", params.limit.toString());

    const queryString = searchParams.toString();
    const url = `${OWNERSHIP_API}/trending${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data: OwnershipTrendingResponse = await response.json();
    if (data.status === "success" && data.data) {
      return data.data;
    }
    return null;
  }

  // API Keys API
  async listApiKeys(getToken: GetTokenFn): Promise<ApiKeyListItem[]> {
    const response = await this.authenticatedRequest<ApiKeyListResponse>(
      `${API_KEYS_API}/`,
      getToken
    );
    if (response.status === "success" && response.data) {
      return response.data;
    }
    return [];
  }

  async createApiKey(
    getToken: GetTokenFn,
    body: CreateApiKeyRequest
  ): Promise<CreateApiKeyResponse> {
    const response = await this.authenticatedRequest<CreateApiKeyResponse>(
      `${API_KEYS_API}/`,
      getToken,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
    return response;
  }

  async revokeApiKey(
    getToken: GetTokenFn,
    keyId: string
  ): Promise<BaseApiResponse> {
    const response = await this.authenticatedRequest<BaseApiResponse>(
      `${API_KEYS_API}/${keyId}`,
      getToken,
      {
        method: "DELETE",
      }
    );
    return response;
  }
}

// Create API client instance
export const apiClient = new ApiClient(API_BASE);
