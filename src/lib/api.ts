import { ApiError } from "./api-error";
import {
  fetchJson,
  nullOn404,
  unwrap,
  unwrapWithMessage,
  type GetTokenFn,
  type RequestOptions,
} from "./http";
import {
  API_BASE,
  LIVE_API,
  TEAMS_API,
  LINEUPS_API,
  RANKINGS_API,
  RANKINGS_INTERNAL_API,
  PLAYERS_API,
  MATCHUPS_API,
  STREAMERS_API,
  YAHOO_API,
  GAMES_API,
  OWNERSHIP_API,
  SCHEDULE_API,
  PLAYOFF_API,
  NOTIFICATIONS_API,
  API_KEYS_API,
  DRAFTS_API,
} from "@/endpoints";
import type {
  RosterPlayer,
  LeagueInfoRequest,
  TeamResponseData,
  TeamGetResponse,
  TeamAddResponse,
  TeamRemoveResponse,
  TeamUpdateResponse,
  LeagueDetail,
  LeagueGetResponse,
  LeagueSyncResponse,
} from "@/types/team";
import type {
  Lineup,
  LineupGenerationRequest,
  GenerateLineupResponse,
  GetLineupsResponse,
  SaveLineupResponse,
  DeleteLineupResponse,
  ScheduleWeeksData,
} from "@/types/lineup";
import type { RankingsMeta, RankingsParams, RankingsPlayer, RankingsResult } from "@/types/rankings";
import { normalizeParams, toApiQuery } from "@/lib/rankings-params";
import type { PlayerStats, PercentileData, PlayerStatusData, PlayerOwnershipData } from "@/types/player";
import type { BaseApiResponse } from "@/types/auth";
import type { GamesOnDateData, TeamScheduleData, NBATeamLiveGameData } from "@/types/games";
import type { NBATeamStatsData, NBATeamRosterData } from "@/types/nba-team";
import type { PlayoffBracketData } from "@/types/playoff";
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
  SeasonSummaryData,
  SeasonSummaryResponse,
} from "@/types/matchup";
import type { StreamerData, StreamerRequest, StreamerResponse } from "@/types/streamer";
import type {
  YahooAuthUrlResponse,
  YahooLeaguesResponse,
  YahooTeamsResponse,
  YahooLeague,
  YahooTeam,
} from "@/types/yahoo";
import type { OwnershipTrendingData, OwnershipTrendingParams } from "@/types/ownership";
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
import type { TeamInsightsData, TeamInsightsResponse } from "@/types/team-insights";
import type {
  DraftBoardMeta,
  DraftBoardResult,
  DraftBoardRow,
  DraftInitSync,
  DraftPick,
  DraftPickCreate,
  DraftRecommendation,
  DraftRosterEntry,
  DraftSession,
  DraftSessionCreate,
  DraftSessionUpdate,
} from "@/types/draft";

/** The lineup optimiser runs a genetic algorithm; give it well beyond the default 15 s. */
const LINEUP_GENERATION_TIMEOUT_MS = 100_000;
/** Streamer search fans out to the league provider for the free-agent pool. */
const STREAMERS_TIMEOUT_MS = 30_000;

/**
 * Every method is one of three shapes:
 * - throw: returns the envelope's `data`; any failure is an `ApiError`
 * - nullOn404: returns null when the thing doesn't exist; other failures throw
 * - raw: returns the whole envelope (mutations read `status`/`message`)
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /** GET a public envelope and return its `data` (null when the backend has none). */
  private async getData<T>(url: string, opts?: RequestOptions): Promise<T | null> {
    const env = await fetchJson<BaseApiResponse<T>>(url, opts);
    return unwrap(env, null);
  }

  // Teams API - calls backend directly
  async getTeams(getToken: GetTokenFn): Promise<TeamResponseData[]> {
    const env = await fetchJson<TeamGetResponse>(`${TEAMS_API}/`, { getToken });
    return unwrap(env, []);
  }

  async addTeam(
    getToken: GetTokenFn,
    teamData: LeagueInfoRequest
  ): Promise<TeamAddResponse> {
    return fetchJson<TeamAddResponse>(`${TEAMS_API}/add`, {
      getToken,
      method: "POST",
      body: { league_info: teamData },
      raw: true,
    });
  }

  async updateTeam(
    getToken: GetTokenFn,
    teamId: number,
    teamData: LeagueInfoRequest
  ): Promise<TeamUpdateResponse> {
    return fetchJson<TeamUpdateResponse>(`${TEAMS_API}/update`, {
      getToken,
      method: "PUT",
      body: { team_id: teamId, league_info: teamData },
      raw: true,
    });
  }

  async deleteTeam(
    getToken: GetTokenFn,
    teamId: number
  ): Promise<TeamRemoveResponse> {
    return fetchJson<TeamRemoveResponse>(`${TEAMS_API}/remove?team_id=${teamId}`, {
      getToken,
      method: "DELETE",
      raw: true,
    });
  }

  async getTeamRoster(
    getToken: GetTokenFn,
    teamId: number
  ): Promise<RosterPlayer[]> {
    const env = await fetchJson<BaseApiResponse<RosterPlayer[]>>(
      `${TEAMS_API}/view?team_id=${teamId}`,
      { getToken }
    );
    return unwrap(env, []);
  }

  async getTeamInsights(
    getToken: GetTokenFn,
    teamId: number
  ): Promise<TeamInsightsData> {
    const env = await fetchJson<TeamInsightsResponse>(`${TEAMS_API}/${teamId}/insights`, {
      getToken,
    });
    return unwrap(env);
  }

  // League settings (provider-detected scoring format) for an owned team
  async getTeamLeague(
    getToken: GetTokenFn,
    teamId: number
  ): Promise<LeagueDetail | null> {
    const env = await fetchJson<LeagueGetResponse>(`${TEAMS_API}/${teamId}/league`, {
      getToken,
    });
    return unwrap(env, null);
  }

  /** Re-fetch league settings from the provider. Returns the raw envelope:
   *  `status` may be `error` with `data` still populated (provider unreachable → defaults). */
  async syncTeamLeague(
    getToken: GetTokenFn,
    teamId: number
  ): Promise<LeagueSyncResponse> {
    return fetchJson<LeagueSyncResponse>(`${TEAMS_API}/${teamId}/league/sync`, {
      getToken,
      method: "POST",
      raw: true,
    });
  }

  // Lineups API - calls backend directly
  async getLineups(getToken: GetTokenFn, teamId: number): Promise<Lineup[]> {
    const env = await fetchJson<GetLineupsResponse>(`${LINEUPS_API}?team_id=${teamId}`, {
      getToken,
    });
    return unwrap(env, []);
  }

  async generateLineup(
    getToken: GetTokenFn,
    data: LineupGenerationRequest
  ): Promise<GenerateLineupResponse> {
    return fetchJson<GenerateLineupResponse>(`${LINEUPS_API}/generate`, {
      getToken,
      method: "POST",
      body: data,
      raw: true,
      timeoutMs: LINEUP_GENERATION_TIMEOUT_MS,
    });
  }

  async saveLineup(
    getToken: GetTokenFn,
    teamId: number,
    lineup: Lineup
  ): Promise<SaveLineupResponse> {
    return fetchJson<SaveLineupResponse>(`${LINEUPS_API}/save`, {
      getToken,
      method: "PUT",
      body: { team_id: teamId, lineup_info: lineup },
      raw: true,
    });
  }

  async deleteLineup(
    getToken: GetTokenFn,
    lineupId: number
  ): Promise<DeleteLineupResponse> {
    return fetchJson<DeleteLineupResponse>(`${LINEUPS_API}/remove?lineup_id=${lineupId}`, {
      getToken,
      method: "DELETE",
      raw: true,
    });
  }

  // Matchups API
  async getMatchup(
    getToken: GetTokenFn,
    teamId: number,
    avgWindow: AvgWindow = "season",
    opts?: RequestOptions
  ): Promise<MatchupData> {
    const env = await fetchJson<MatchupResponse>(
      `${MATCHUPS_API}/current/${teamId}?avg_window=${avgWindow}`,
      { ...opts, getToken }
    );
    return unwrap(env);
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
    return nullOn404(
      fetchJson<MatchupScoreHistoryResponse>(url, { getToken }).then((env) => unwrap(env, null))
    );
  }

  async getLiveMatchup(
    getToken: GetTokenFn,
    teamId: number,
    opts?: RequestOptions
  ): Promise<LiveMatchupData> {
    const env = await fetchJson<LiveMatchupResponse>(`${MATCHUPS_API}/live/${teamId}`, {
      ...opts,
      getToken,
    });
    return unwrap(env);
  }

  async getDailyMatchup(
    getToken: GetTokenFn,
    teamId: number,
    date: string,
    opts?: RequestOptions
  ): Promise<DailyMatchupData> {
    const env = await fetchJson<DailyMatchupResponse>(
      `${MATCHUPS_API}/daily/${teamId}?date=${date}`,
      { ...opts, getToken }
    );
    return unwrap(env);
  }

  async getWeeklyMatchup(
    getToken: GetTokenFn,
    teamId: number
  ): Promise<WeeklyMatchupData> {
    const env = await fetchJson<WeeklyMatchupResponse>(`${MATCHUPS_API}/week/${teamId}`, {
      getToken,
    });
    return unwrap(env);
  }

  async getSeasonSummary(
    getToken: GetTokenFn,
    teamId: number
  ): Promise<SeasonSummaryData | null> {
    return nullOn404(
      fetchJson<SeasonSummaryResponse>(`${MATCHUPS_API}/season-summary/${teamId}`, {
        getToken,
      }).then((env) => unwrap(env, null))
    );
  }

  // Breakout Streamers API (internal, Clerk auth)
  async getBreakoutStreamers(
    getToken: GetTokenFn,
    limit: number = 30,
    team?: string
  ): Promise<BreakoutData | null> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (team) params.set("team", team);
    return nullOn404(
      fetchJson<BreakoutResponse>(`${STREAMERS_API}/breakout?${params}`, { getToken }).then(
        (env) => unwrap(env, null)
      )
    );
  }

  // Streamers API
  async findStreamers(
    getToken: GetTokenFn,
    request: StreamerRequest,
    opts?: RequestOptions
  ): Promise<StreamerData> {
    const env = await fetchJson<StreamerResponse>(`${STREAMERS_API}/find`, {
      ...opts,
      getToken,
      method: "POST",
      body: request,
      timeoutMs: STREAMERS_TIMEOUT_MS,
    });
    return unwrap(env);
  }

  // Yahoo API
  async getYahooAuthUrl(getToken: GetTokenFn): Promise<string> {
    const env = await fetchJson<YahooAuthUrlResponse>(`${YAHOO_API}/authorize`, { getToken });
    if (!env.auth_url) throw ApiError.empty(env);
    return env.auth_url;
  }

  async getYahooLeagues(
    getToken: GetTokenFn,
    connectionId: number
  ): Promise<YahooLeague[]> {
    const env = await fetchJson<YahooLeaguesResponse>(
      `${YAHOO_API}/leagues?connection_id=${encodeURIComponent(connectionId)}`,
      { getToken }
    );
    return env.leagues ?? [];
  }

  async getYahooTeams(
    getToken: GetTokenFn,
    connectionId: number,
    leagueKey: string
  ): Promise<YahooTeam[]> {
    const env = await fetchJson<YahooTeamsResponse>(
      `${YAHOO_API}/teams?connection_id=${encodeURIComponent(connectionId)}&league_key=${encodeURIComponent(leagueKey)}`,
      { getToken }
    );
    return env.teams ?? [];
  }

  // Notifications API
  async getNotificationPreferences(
    getToken: GetTokenFn
  ): Promise<NotificationPreference> {
    const env = await fetchJson<NotificationPreferenceResponse>(
      `${NOTIFICATIONS_API}/preferences`,
      { getToken }
    );
    return unwrap(env);
  }

  async updateNotificationPreferences(
    getToken: GetTokenFn,
    data: NotificationPreference
  ): Promise<NotificationPreference> {
    const env = await fetchJson<NotificationPreferenceResponse>(
      `${NOTIFICATIONS_API}/preferences`,
      { getToken, method: "PUT", body: data }
    );
    return unwrap(env);
  }

  async getTeamNotificationPreferences(
    getToken: GetTokenFn
  ): Promise<NotificationTeamPreference[]> {
    const env = await fetchJson<NotificationTeamPreferenceListResponse>(
      `${NOTIFICATIONS_API}/team-preferences`,
      { getToken }
    );
    return unwrap(env, []);
  }

  async upsertTeamNotificationPreference(
    getToken: GetTokenFn,
    teamId: number,
    data: NotificationTeamPreferenceRequest
  ): Promise<NotificationTeamPreference> {
    const env = await fetchJson<NotificationTeamPreferenceSingleResponse>(
      `${NOTIFICATIONS_API}/team-preferences/${teamId}`,
      { getToken, method: "PUT", body: data }
    );
    return unwrap(env);
  }

  async deleteTeamNotificationPreference(
    getToken: GetTokenFn,
    teamId: number
  ): Promise<void> {
    await fetchJson<BaseApiResponse>(`${NOTIFICATIONS_API}/team-preferences/${teamId}`, {
      getToken,
      method: "DELETE",
    });
  }

  // Live API (public - no auth required)
  async getLivePlayersToday(opts?: RequestOptions): Promise<LivePlayersData> {
    const env = await fetchJson<LivePlayersResponse>(`${LIVE_API}/players/today`, opts);
    return unwrap(env);
  }

  // Rankings API (public - no auth required)
  async getRankings(): Promise<RankingsPlayer[]> {
    const env = await fetchJson<BaseApiResponse<RankingsPlayer[]>>(`${RANKINGS_API}/`);
    return unwrap(env, []);
  }

  /**
   * Rankings with the response `meta` block, in either format. Points-season
   * (the default) matches `getRankings()` row for row. Empty states (offseason)
   * come back as an empty list with the backend's `message`.
   */
  async getRankingsWithMeta(
    params?: Partial<RankingsParams> | null,
    opts?: RequestOptions
  ): Promise<RankingsResult> {
    const qs = toApiQuery(normalizeParams(params));
    const env = await fetchJson<BaseApiResponse<RankingsPlayer[]> & { meta?: RankingsMeta | null }>(
      `${RANKINGS_API}/${qs ? `?${qs}` : ""}`,
      opts
    );
    const { data, message } = unwrapWithMessage(env, []);
    return { players: data, meta: env.meta ?? null, message };
  }

  /**
   * Rankings scored by a team's league settings rather than the platform
   * default. `format` and `categories` are not sent: the league decides those,
   * and the response reports which in `meta.scoring`.
   */
  async getLeagueRankingsWithMeta(
    getToken: GetTokenFn,
    teamId: number,
    params?: Partial<RankingsParams> | null,
    opts?: RequestOptions
  ): Promise<RankingsResult> {
    const p = normalizeParams(params);
    const q = new URLSearchParams();
    if (p.window !== null) q.set("window", String(p.window));
    if (p.minGames !== null) q.set("min_games", String(p.minGames));
    const qs = q.toString();
    const env = await fetchJson<BaseApiResponse<RankingsPlayer[]> & { meta?: RankingsMeta | null }>(
      `${RANKINGS_INTERNAL_API}/${teamId}${qs ? `?${qs}` : ""}`,
      { ...opts, getToken }
    );
    const { data, message } = unwrapWithMessage(env, []);
    return { players: data, meta: env.meta ?? null, message };
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
    return nullOn404(this.getData<PlayerStats>(`${PLAYERS_API}/stats?${searchParams.toString()}`));
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
    return nullOn404(this.getData<PlayerStats>(`${PLAYERS_API}/stats?${params.toString()}`));
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
    return nullOn404(this.getData<PercentileData>(url));
  }

  async getPlayerStatus(playerId: number): Promise<PlayerStatusData | null> {
    return nullOn404(this.getData<PlayerStatusData>(`${PLAYERS_API}/${playerId}/status`));
  }

  async getPlayerOwnership(playerId: number, days: number = 14): Promise<PlayerOwnershipData | null> {
    const params = days !== 14 ? `?days=${days}` : "";
    return nullOn404(
      this.getData<PlayerOwnershipData>(`${PLAYERS_API}/${playerId}/ownership${params}`)
    );
  }

  async getTeamSchedule(teamAbbrev: string, upcoming: boolean = false, limit: number = 12): Promise<TeamScheduleData | null> {
    const params = new URLSearchParams();
    if (upcoming) params.append("upcoming", "true");
    if (limit !== 20) params.append("limit", limit.toString());
    const queryString = params.toString();
    const url = `${API_BASE}/v1/teams/${teamAbbrev}/schedule${queryString ? `?${queryString}` : ""}`;
    return nullOn404(this.getData<TeamScheduleData>(url));
  }

  async getNBATeamStats(abbrev: string): Promise<NBATeamStatsData | null> {
    return nullOn404(this.getData<NBATeamStatsData>(`${API_BASE}/v1/teams/${abbrev}/stats`));
  }

  async getNBATeamRoster(abbrev: string): Promise<NBATeamRosterData | null> {
    return nullOn404(this.getData<NBATeamRosterData>(`${API_BASE}/v1/teams/${abbrev}/roster`));
  }

  async getNBATeamLiveGame(abbrev: string, opts?: RequestOptions): Promise<NBATeamLiveGameData | null> {
    return nullOn404(
      this.getData<NBATeamLiveGameData>(`${API_BASE}/v1/teams/${abbrev}/live-game`, opts)
    );
  }

  // Games API (public - no auth required)
  async getGamesOnDate(date: string, opts?: RequestOptions): Promise<GamesOnDateData | null> {
    return nullOn404(this.getData<GamesOnDateData>(`${GAMES_API}/${date}`, opts));
  }

  // Schedule API (public - no auth required)
  async getScheduleWeeks(): Promise<ScheduleWeeksData | null> {
    return nullOn404(this.getData<ScheduleWeeksData>(`${SCHEDULE_API}/weeks`));
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
    return nullOn404(this.getData<OwnershipTrendingData>(url));
  }

  // API Keys API
  async listApiKeys(getToken: GetTokenFn): Promise<ApiKeyListItem[]> {
    const env = await fetchJson<ApiKeyListResponse>(`${API_KEYS_API}/`, { getToken });
    return unwrap(env, []);
  }

  async createApiKey(
    getToken: GetTokenFn,
    body: CreateApiKeyRequest
  ): Promise<CreateApiKeyResponse> {
    return fetchJson<CreateApiKeyResponse>(`${API_KEYS_API}/`, {
      getToken,
      method: "POST",
      body,
    });
  }

  async revokeApiKey(
    getToken: GetTokenFn,
    keyId: string
  ): Promise<BaseApiResponse> {
    return fetchJson<BaseApiResponse>(`${API_KEYS_API}/${keyId}`, {
      getToken,
      method: "DELETE",
    });
  }

  async getPlayoffBracket(season?: string): Promise<PlayoffBracketData | null> {
    const url = season
      ? `${PLAYOFF_API}/bracket?season=${season}`
      : `${PLAYOFF_API}/bracket`;
    return nullOn404(this.getData<PlayoffBracketData>(url));
  }

  // Drafts API (internal - Clerk auth required)

  async getDraftSessions(getToken: GetTokenFn): Promise<DraftSession[]> {
    const env = await fetchJson<BaseApiResponse<DraftSession[]>>(DRAFTS_API, { getToken });
    return unwrap(env, []);
  }

  async getDraftSession(getToken: GetTokenFn, sessionId: number): Promise<DraftSession> {
    const env = await fetchJson<BaseApiResponse<DraftSession>>(`${DRAFTS_API}/${sessionId}`, {
      getToken,
    });
    return unwrap(env);
  }

  async createDraftSession(getToken: GetTokenFn, body: DraftSessionCreate): Promise<DraftSession> {
    const env = await fetchJson<BaseApiResponse<DraftSession>>(DRAFTS_API, {
      getToken,
      method: "POST",
      body,
    });
    return unwrap(env);
  }

  async updateDraftSession(
    getToken: GetTokenFn,
    sessionId: number,
    body: DraftSessionUpdate
  ): Promise<DraftSession> {
    const env = await fetchJson<BaseApiResponse<DraftSession>>(`${DRAFTS_API}/${sessionId}`, {
      getToken,
      method: "PATCH",
      body,
    });
    return unwrap(env);
  }

  /**
   * The room's board. `meta` and `recommendations` ride beside `data` on the
   * envelope, so this composes them rather than unwrapping and losing them
   * (the `getRankingsWithMeta` pattern).
   */
  async getDraftBoard(
    getToken: GetTokenFn,
    sessionId: number,
    opts?: RequestOptions
  ): Promise<DraftBoardResult> {
    const env = await fetchJson<
      BaseApiResponse<DraftBoardRow[]> & {
        meta?: DraftBoardMeta | null;
        recommendations?: DraftRecommendation[] | null;
        roster?: DraftRosterEntry[] | null;
      }
    >(`${DRAFTS_API}/${sessionId}/board`, { ...opts, getToken });
    const { data, message } = unwrapWithMessage(env, []);
    return {
      rows: data,
      recommendations: env.recommendations ?? [],
      roster: env.roster ?? [],
      meta: env.meta ?? null,
      message,
    };
  }

  /**
   * The stateless big board for a team, with pick state passed in. No session
   * required, and it carries no recommendations — use `getDraftBoard` once a
   * room is open.
   */
  async getTeamDraftBoard(
    getToken: GetTokenFn,
    teamId: number,
    picked: number[] = [],
    mine: number[] = [],
    opts?: RequestOptions
  ): Promise<DraftBoardResult> {
    const q = new URLSearchParams({ team_id: String(teamId) });
    for (const id of picked) q.append("picked", String(id));
    for (const id of mine) q.append("mine", String(id));
    const env = await fetchJson<
      BaseApiResponse<DraftBoardRow[]> & {
        meta?: DraftBoardMeta | null;
        recommendations?: DraftRecommendation[] | null;
        roster?: DraftRosterEntry[] | null;
      }
    >(`${DRAFTS_API}/board?${q.toString()}`, { ...opts, getToken });
    const { data, message } = unwrapWithMessage(env, []);
    return {
      rows: data,
      recommendations: env.recommendations ?? [],
      roster: env.roster ?? [],
      meta: env.meta ?? null,
      message,
    };
  }

  /**
   * Record a pick. Deliberately NOT `raw: true`: the route answers 400/404/409/422
   * for real, and the pick mutation needs those to reject so its optimistic
   * update rolls back.
   */
  async addDraftPick(
    getToken: GetTokenFn,
    sessionId: number,
    body: DraftPickCreate
  ): Promise<DraftPick> {
    const env = await fetchJson<BaseApiResponse<DraftPick>>(`${DRAFTS_API}/${sessionId}/picks`, {
      getToken,
      method: "POST",
      body,
    });
    return unwrap(env);
  }

  /** Undo a pick; resolves to the overall pick number that was removed. */
  async deleteDraftPick(
    getToken: GetTokenFn,
    sessionId: number,
    overallPick: number
  ): Promise<number> {
    const env = await fetchJson<BaseApiResponse<number>>(
      `${DRAFTS_API}/${sessionId}/picks/${overallPick}`,
      { getToken, method: "DELETE" }
    );
    return unwrap(env);
  }

  /**
   * Reconcile a session with the ESPN draft room's INIT snapshot. A large
   * payload (a 30-team late join) and a per-pick round trip inside one request
   * both argue for a longer timeout than the default 15 s.
   */
  async syncDraftInit(getToken: GetTokenFn, sessionId: number, payload: string): Promise<DraftInitSync> {
    const env = await fetchJson<BaseApiResponse<DraftInitSync>>(`${DRAFTS_API}/${sessionId}/sync/init`, {
      getToken,
      method: "POST",
      body: { payload },
      timeoutMs: 30_000,
    });
    return unwrap(env);
  }
}

// Create API client instance
export const apiClient = new ApiClient(API_BASE);
