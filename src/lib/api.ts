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
  DRAFTS_API,
  CONNECTIONS_API,
} from "@/endpoints";
import type {
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
  EspnAccountTeam,
  EspnAccountTeamsResponse,
  EspnConnectRequest,
  ProviderConnection,
  ProviderConnectionDeleteResponse,
  ProviderConnectionListResponse,
  ProviderConnectionResponse,
} from "@/types/connections";
import type {
  ScheduleWeeksData,
} from "@/types/lineup";
import type { RankingsMeta, RankingsParams, RankingsPlayer, RankingsResult } from "@/types/rankings";
import { normalizeParams, toApiQuery } from "@/lib/rankings-params";
import type { PlayerStats, PercentileData, PlayerStatusData, PlayerOwnershipData } from "@/types/player";
import type { BaseApiResponse } from "@/types/auth";
import type {
  ESPNMarketData,
  ESPNMarketMovementData,
  MarketDirection,
  MarketSort,
  PlayerProfileData,
  PlayerProjectionData,
  PlayerSearchData,
  PlayerTrendsData,
} from "@/types/scout";
import type { GamesOnDateData, TeamScheduleData, NBATeamLiveGameData } from "@/types/games";
import type { NBATeamStatsData, NBATeamRosterData } from "@/types/nba-team";
import type {
  MatchupData,
  MatchupResponse,
  AvgWindow,
  LiveMatchupData,
  LiveMatchupResponse,
  DailyMatchupData,
  DailyMatchupResponse,
  WeeklyMatchupData,
  WeeklyMatchupResponse,
} from "@/types/matchup";
import type { StreamerData, StreamerFindRequest, StreamerResponse } from "@/types/streamer";
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
import type {
  ApplyLineupMovesData,
  ApplyLineupMovesRequest,
  ApplyLineupMovesResponse,
  LineupPlanData,
  LineupPlanResponse,
  LineupState,
  LineupStateResponse,
} from "@/types/lineup-editor";
import type {
  RosterTransactionData,
  RosterTransactionRequest,
  RosterTransactionResponse,
} from "@/types/roster-transaction";
import type {
  SchedulePickupRequest,
  ScheduledPickup,
  ScheduledPickupList,
  ScheduledPickupListResponse,
  ScheduledPickupResponse,
} from "@/types/scheduled-pickup";
import type {
  DraftBoardMeta,
  DraftBoardResult,
  DraftBoardRow,
  DraftImport,
  DraftInitSync,
  DraftRecapResult,
  MockAdvance,
  MockUntil,
  DraftPick,
  DraftPickCreate,
  DraftRecommendation,
  BoardSource,
  DraftRosterEntry,
  DraftSession,
  DraftSessionCreate,
  DraftSessionUpdate,
  RecapMeta,
  RecapPick,
  RecapSeat,
  RecapStanding,
} from "@/types/draft";

/** The lineup optimiser runs a genetic algorithm; give it well beyond the default 15 s. */
const LINEUP_GENERATION_TIMEOUT_MS = 100_000;
/** Streamer search fans out to the league provider for the free-agent pool. */
const STREAMERS_TIMEOUT_MS = 30_000;
/** A lineup write goes to ESPN and re-reads the roster before answering. */
const LINEUP_WRITE_TIMEOUT_MS = 45_000;
/** Connecting or re-checking an ESPN account reads ESPN up to four times first. */
const ESPN_CHECK_TIMEOUT_MS = 30_000;

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

  // An ESPN lineup: today's, or a later day's when `scoringPeriodId` (ESPN's day
  // number, 1 = opening night) is given. Yahoo teams answer 200 with `data: null`.
  async getTeamLineup(
    getToken: GetTokenFn,
    teamId: number,
    opts?: RequestOptions,
    scoringPeriodId?: number
  ): Promise<LineupState | null> {
    const query = scoringPeriodId != null ? `?scoring_period_id=${scoringPeriodId}` : "";
    const env = await fetchJson<LineupStateResponse>(`${TEAMS_API}/${teamId}/lineup${query}`, {
      ...opts,
      getToken,
    });
    return unwrap(env, null);
  }

  /** The fill-only moves Court Vision would make today. Never writes. */
  async getTeamLineupPlan(
    getToken: GetTokenFn,
    teamId: number,
    opts?: RequestOptions
  ): Promise<LineupPlanData> {
    const env = await fetchJson<LineupPlanResponse>(`${TEAMS_API}/${teamId}/lineup/plan`, {
      ...opts,
      getToken,
    });
    return unwrap(env);
  }

  /**
   * Send slot moves to ESPN as one transaction. Deliberately NOT `raw`: the
   * route answers 403/409/422/503 for real (ROSTER_STALE hands back the fresh
   * board in `data.lineup`) and the mutation reads those as rejections. The
   * write proxies to ESPN and re-reads the roster, hence the long timeout.
   */
  async applyLineupMoves(
    getToken: GetTokenFn,
    teamId: number,
    body: ApplyLineupMovesRequest
  ): Promise<ApplyLineupMovesData> {
    const env = await fetchJson<ApplyLineupMovesResponse>(
      `${TEAMS_API}/${teamId}/lineup/moves`,
      { getToken, method: "POST", body, timeoutMs: LINEUP_WRITE_TIMEOUT_MS }
    );
    return unwrap(env);
  }

  /**
   * Pick up and/or release one player as a single ESPN transaction. Same
   * contract as `applyLineupMoves` — deliberately NOT `raw`, so the real
   * 403/409/422/503 statuses reject (ROSTER_STALE hands back the fresh board
   * in `data.lineup`, ROSTER_TRANSACTION_INVALID a `data.reason`), and the
   * same long timeout: the write proxies to ESPN and re-reads the roster.
   */
  async applyRosterTransaction(
    getToken: GetTokenFn,
    teamId: number,
    body: RosterTransactionRequest
  ): Promise<RosterTransactionData> {
    const env = await fetchJson<RosterTransactionResponse>(
      `${TEAMS_API}/${teamId}/roster/transactions`,
      { getToken, method: "POST", body, timeoutMs: LINEUP_WRITE_TIMEOUT_MS }
    );
    return unwrap(env);
  }

  /**
   * A team's scheduled pickups: pending (soonest day first) and those settled
   * in the last week (newest first).
   */
  async getScheduledPickups(
    getToken: GetTokenFn,
    teamId: number,
    opts?: RequestOptions
  ): Promise<ScheduledPickupList> {
    const env = await fetchJson<ScheduledPickupListResponse>(`${TEAMS_API}/${teamId}/pickups`, {
      ...opts,
      getToken,
    });
    return unwrap(env, { pending: [], recent: [] });
  }

  /**
   * Schedule a free-agent add (optionally with a drop) for a later ESPN day.
   * Deliberately NOT `raw`: 422 SCHEDULED_PICKUP_INVALID (with `data.reason`)
   * and 409 SCHEDULED_PICKUP_DUPLICATE reject, and their `message` is already
   * a user sentence. The server reads the board and ESPN's pool first.
   */
  async schedulePickup(
    getToken: GetTokenFn,
    teamId: number,
    body: SchedulePickupRequest
  ): Promise<{ pickup: ScheduledPickup; message: string }> {
    const env = await fetchJson<ScheduledPickupResponse>(`${TEAMS_API}/${teamId}/pickups`, {
      getToken,
      method: "POST",
      body,
      timeoutMs: LINEUP_WRITE_TIMEOUT_MS,
    });
    return { pickup: unwrap(env), message: env.message };
  }

  /** Cancel a pending pickup; 409 SCHEDULED_PICKUP_NOT_PENDING once it has run. */
  async cancelPickup(getToken: GetTokenFn, teamId: number, pickupId: number): Promise<ScheduledPickup> {
    const env = await fetchJson<ScheduledPickupResponse>(`${TEAMS_API}/${teamId}/pickups/${pickupId}`, {
      getToken,
      method: "DELETE",
    });
    return unwrap(env);
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

  /**
   * Streamer candidates for a saved team. The league and its credentials
   * come from the team on the server, so the body is only the search options.
   */
  async findStreamers(
    getToken: GetTokenFn,
    teamId: number,
    body: StreamerFindRequest,
    opts?: RequestOptions
  ): Promise<StreamerData> {
    const env = await fetchJson<StreamerResponse>(`${TEAMS_API}/${teamId}/streamers/find`, {
      ...opts,
      getToken,
      method: "POST",
      body,
      timeoutMs: STREAMERS_TIMEOUT_MS,
    });
    return unwrap(env);
  }

  // Yahoo API
  /**
   * The Yahoo authorize URL. `returnTo` is the path on this app the callback
   * sends the browser back to afterwards (with `?yahoo_connected=true&
   * yahoo_connection=<id>` or `?yahoo_error=<code>` appended); the backend
   * falls back to Manage Teams when it is not a plain path of our own.
   */
  async getYahooAuthUrl(getToken: GetTokenFn, returnTo?: string): Promise<string> {
    const query = returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : "";
    const env = await fetchJson<YahooAuthUrlResponse>(`${YAHOO_API}/authorize${query}`, { getToken });
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

  // Provider connections: an ESPN account's cookies, stored once for every team on it
  async getConnections(getToken: GetTokenFn): Promise<ProviderConnection[]> {
    const env = await fetchJson<ProviderConnectionListResponse>(`${CONNECTIONS_API}/`, { getToken });
    return unwrap(env, []);
  }

  async connectEspn(
    getToken: GetTokenFn,
    body: EspnConnectRequest
  ): Promise<ProviderConnectionResponse> {
    return fetchJson<ProviderConnectionResponse>(`${CONNECTIONS_API}/espn`, {
      getToken,
      method: "POST",
      body,
      timeoutMs: ESPN_CHECK_TIMEOUT_MS,
    });
  }

  async verifyConnection(
    getToken: GetTokenFn,
    connectionId: number
  ): Promise<ProviderConnectionResponse> {
    return fetchJson<ProviderConnectionResponse>(`${CONNECTIONS_API}/${connectionId}/verify`, {
      getToken,
      method: "POST",
      timeoutMs: ESPN_CHECK_TIMEOUT_MS,
    });
  }

  async getEspnAccountTeams(
    getToken: GetTokenFn,
    connectionId: number
  ): Promise<EspnAccountTeam[]> {
    const env = await fetchJson<EspnAccountTeamsResponse>(
      `${CONNECTIONS_API}/${connectionId}/espn/teams`,
      { getToken }
    );
    return unwrap(env, []);
  }

  async deleteConnection(
    getToken: GetTokenFn,
    connectionId: number
  ): Promise<ProviderConnectionDeleteResponse> {
    return fetchJson<ProviderConnectionDeleteResponse>(`${CONNECTIONS_API}/${connectionId}`, {
      getToken,
      method: "DELETE",
    });
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

  // The player directory and the per-player extras the Scout desk reads (public)

  /** Search the player dimension by name or id: rookies and players without games included. */
  async searchPlayers(q: string, limit: number = 10, opts?: RequestOptions): Promise<PlayerSearchData | null> {
    const params = new URLSearchParams({ q, limit: limit.toString() });
    return this.getData<PlayerSearchData>(`${PLAYERS_API}/search?${params.toString()}`, opts);
  }

  /** Identity plus the biographical snapshot; `profile` is null until the pipeline has one. */
  async getPlayerProfile(playerId: number, opts?: RequestOptions): Promise<PlayerProfileData | null> {
    return nullOn404(this.getData<PlayerProfileData>(`${PLAYERS_API}/${playerId}/profile`, opts));
  }

  /** Rolling 7/14/30-day fantasy averages and the ownership change. */
  async getPlayerTrends(playerId: number, opts?: RequestOptions): Promise<PlayerTrendsData | null> {
    return nullOn404(this.getData<PlayerTrendsData>(`${PLAYERS_API}/${playerId}/trends`, opts));
  }

  /** ESPN's preseason per-game projection; null for a player without one. */
  async getPlayerProjection(playerId: number, opts?: RequestOptions): Promise<PlayerProjectionData | null> {
    return nullOn404(this.getData<PlayerProjectionData>(`${PLAYERS_API}/${playerId}/projection`, opts));
  }

  /** ESPN's draft market (editorial rank, ADP, auction values), newest snapshot, optionally by name. */
  async getEspnMarket(
    params: { name?: string; sortBy?: MarketSort; limit?: number; offset?: number } = {},
    opts?: RequestOptions
  ): Promise<ESPNMarketData | null> {
    const q = new URLSearchParams();
    if (params.name) q.set("name", params.name);
    if (params.sortBy) q.set("sort_by", params.sortBy);
    if (params.limit !== undefined) q.set("limit", params.limit.toString());
    if (params.offset !== undefined) q.set("offset", params.offset.toString());
    const qs = q.toString();
    return this.getData<ESPNMarketData>(`${RANKINGS_API}/espn${qs ? `?${qs}` : ""}`, opts);
  }

  /** How the ESPN market moved between the snapshots on or before two dates. */
  async getEspnMarketMovement(
    params: { fromAsOf: string; toAsOf: string; metric?: MarketSort; direction?: MarketDirection; limit?: number },
    opts?: RequestOptions
  ): Promise<ESPNMarketMovementData | null> {
    const q = new URLSearchParams({ from_as_of: params.fromAsOf, to_as_of: params.toAsOf });
    if (params.metric) q.set("metric", params.metric);
    if (params.direction) q.set("direction", params.direction);
    if (params.limit !== undefined) q.set("limit", params.limit.toString());
    return this.getData<ESPNMarketMovementData>(`${RANKINGS_API}/espn/movement?${q.toString()}`, opts);
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
  /** Delete a session and every pick in it; resolves to the deleted id. */
  async deleteDraftSession(getToken: GetTokenFn, sessionId: number): Promise<number> {
    const env = await fetchJson<BaseApiResponse<number>>(`${DRAFTS_API}/${sessionId}`, {
      getToken,
      method: "DELETE",
    });
    return unwrap(env);
  }

  async getDraftBoard(
    getToken: GetTokenFn,
    sessionId: number,
    boardSource: BoardSource = "espn",
    playoffWeight: number | null = null,
    opts?: RequestOptions
  ): Promise<DraftBoardResult> {
    const q = new URLSearchParams({ board: boardSource });
    // Omitted, the server uses its default; sent, it is snapped to an offered step.
    if (playoffWeight !== null) q.set("playoff_weight", String(playoffWeight));
    const env = await fetchJson<
      BaseApiResponse<DraftBoardRow[]> & {
        meta?: DraftBoardMeta | null;
        recommendations?: DraftRecommendation[] | null;
        roster?: DraftRosterEntry[] | null;
      }
    >(`${DRAFTS_API}/${sessionId}/board?${q.toString()}`, { ...opts, getToken });
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

  /**
   * Run the mock autopicker forward. Deliberately not `raw`: the route refuses
   * for real (not a mock, already following an ESPN draft, not active, no
   * pick order, no slot) and the room turns those into the reason the button
   * could not run. The longer timeout is for `until: "end"`, which writes
   * every remaining pick inside the one request.
   */
  async advanceMockDraft(
    getToken: GetTokenFn,
    sessionId: number,
    until: MockUntil
  ): Promise<MockAdvance> {
    const env = await fetchJson<BaseApiResponse<MockAdvance>>(
      `${DRAFTS_API}/${sessionId}/mock/advance`,
      { getToken, method: "POST", body: { until }, timeoutMs: 30_000 }
    );
    return unwrap(env);
  }

  /**
   * The finished draft read back: every pick priced, every seat graded, the
   * standings projected. Like the board, `seats`, `standings` and `meta` ride
   * beside `data`, so the envelope is composed rather than unwrapped.
   */
  async getDraftRecap(
    getToken: GetTokenFn,
    sessionId: number,
    opts?: RequestOptions
  ): Promise<DraftRecapResult> {
    const env = await fetchJson<
      BaseApiResponse<RecapPick[]> & {
        seats?: RecapSeat[] | null;
        standings?: RecapStanding[] | null;
        meta?: RecapMeta | null;
      }
    >(`${DRAFTS_API}/${sessionId}/recap`, { ...opts, getToken, timeoutMs: 30_000 });
    const { data, message } = unwrapWithMessage(env, []);
    return {
      picks: data,
      seats: env.seats ?? [],
      standings: env.standings ?? [],
      meta: env.meta ?? null,
      message,
    };
  }

  /**
   * Fold a completed ESPN draft into a session. Deliberately not `raw`: the
   * route refuses for real (409 before the draft finishes, 400 for a team that
   * is not ESPN's, 409 when another room already follows that draft) and the
   * import dialog turns those into the reason it could not run. The longer
   * timeout covers the provider round trip.
   */
  async importDraft(getToken: GetTokenFn, sessionId: number): Promise<DraftImport> {
    const env = await fetchJson<BaseApiResponse<DraftImport>>(
      `${DRAFTS_API}/${sessionId}/import`,
      { getToken, method: "POST", timeoutMs: 30_000 }
    );
    return unwrap(env);
  }
}

// Create API client instance
export const apiClient = new ApiClient(API_BASE);
