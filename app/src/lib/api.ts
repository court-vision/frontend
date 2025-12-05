import { getClientAuthHeaders } from "./auth";
import { BACKEND_ENDPOINT, TEAMS_API, LINEUPS_API } from "@/endpoints";
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
import type { StandingsPlayer, StandingsPlayerStats } from "@/types/standings";
import type { RankingsPlayer } from "@/types/rankings";
import type { BaseApiResponse } from "@/types/auth";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const authHeaders = await getClientAuthHeaders();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(authHeaders.Authorization && {
          Authorization: authHeaders.Authorization,
        }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  private async authenticatedRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const authHeaders = await getClientAuthHeaders();

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(authHeaders.Authorization && {
          Authorization: authHeaders.Authorization,
        }),
        ...options.headers,
      },
    });

    const data = await response.json();
    return data;
  }

  // Teams API - calls backend directly
  async getTeams(): Promise<TeamResponseData[]> {
    const response = await this.authenticatedRequest<TeamGetResponse>(
      `${TEAMS_API}/`
    );
    if (response.status === "success" && response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to fetch teams");
  }

  async addTeam(teamData: LeagueInfoRequest): Promise<TeamAddResponse> {
    const response = await this.authenticatedRequest<TeamAddResponse>(
      `${TEAMS_API}/add`,
      {
        method: "POST",
        body: JSON.stringify({ league_info: teamData }),
      }
    );
    return response;
  }

  async updateTeam(
    teamId: number,
    teamData: LeagueInfoRequest
  ): Promise<TeamUpdateResponse> {
    const response = await this.authenticatedRequest<TeamUpdateResponse>(
      `${TEAMS_API}/update`,
      {
        method: "PUT",
        body: JSON.stringify({ team_id: teamId, league_info: teamData }),
      }
    );
    return response;
  }

  async deleteTeam(teamId: number): Promise<TeamRemoveResponse> {
    const response = await this.authenticatedRequest<TeamRemoveResponse>(
      `${TEAMS_API}/remove?team_id=${teamId}`,
      {
        method: "DELETE",
      }
    );
    return response;
  }

  async getTeamRoster(teamId: number): Promise<RosterPlayer[]> {
    const response = await this.authenticatedRequest<
      BaseApiResponse<RosterPlayer[]>
    >(`${TEAMS_API}/view?team_id=${teamId}`);
    if (response.status === "success" && response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to fetch team roster");
  }

  // Lineups API - calls backend directly
  async getLineups(teamId: number): Promise<Lineup[]> {
    const response = await this.authenticatedRequest<GetLineupsResponse>(
      `${LINEUPS_API}?team_id=${teamId}`
    );
    if (response.status === "success" && response.data) {
      return response.data;
    }
    return [];
  }

  async generateLineup(data: LineupGenerationRequest): Promise<GenerateLineupResponse> {
    const response = await this.authenticatedRequest<GenerateLineupResponse>(
      `${LINEUPS_API}/generate`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return response;
  }

  async saveLineup(teamId: number, lineup: Lineup): Promise<SaveLineupResponse> {
    const response = await this.authenticatedRequest<SaveLineupResponse>(
      `${LINEUPS_API}/save`,
      {
        method: "PUT",
        body: JSON.stringify({ team_id: teamId, lineup_info: lineup }),
      }
    );
    return response;
  }

  async deleteLineup(lineupId: number): Promise<DeleteLineupResponse> {
    const response = await this.authenticatedRequest<DeleteLineupResponse>(
      `${LINEUPS_API}/remove?lineup_id=${lineupId}`,
      {
        method: "DELETE",
      }
    );
    return response;
  }

  // Standings API
  async getStandings(): Promise<StandingsPlayer[]> {
    return this.request<StandingsPlayer[]>("/fpts-standings");
  }

  async getPlayerStats(playerName: string): Promise<StandingsPlayerStats> {
    return this.request<StandingsPlayerStats>(
      `/fpts-standings/player-stats?player_name=${encodeURIComponent(
        playerName
      )}`
    );
  }

  // Rankings API (using static JSON files)
  async getRankings(model: string): Promise<RankingsPlayer[]> {
    const response = await fetch(`/rankings-data/${model}.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch rankings for model: ${model}`);
    }
    return response.json();
  }
}

// Create API client instance
export const apiClient = new ApiClient(BACKEND_ENDPOINT);

// Helper function to get API client with auth headers
export async function createAuthenticatedRequest(
  endpoint: string,
  options: RequestInit = {}
) {
  const authHeaders = await getClientAuthHeaders();

  return fetch(`${BACKEND_ENDPOINT}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authHeaders.Authorization && {
        Authorization: authHeaders.Authorization,
      }),
      ...options.headers,
    },
  });
}
