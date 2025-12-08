import { getClientAuthHeaders } from "./auth";
import {
  API_BASE,
  TEAMS_API,
  LINEUPS_API,
  STANDINGS_API,
  PLAYERS_API,
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
import type { StandingsPlayer } from "@/types/standings";
import type { PlayerStats } from "@/types/player";
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

  async generateLineup(
    data: LineupGenerationRequest
  ): Promise<GenerateLineupResponse> {
    const response = await this.authenticatedRequest<GenerateLineupResponse>(
      `${LINEUPS_API}/generate`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    console.log(response);
    return response;
  }

  async saveLineup(
    teamId: number,
    lineup: Lineup
  ): Promise<SaveLineupResponse> {
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
    const response = await fetch(`${STANDINGS_API}/`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data: BaseApiResponse<StandingsPlayer[]> = await response.json();
    if (data.status === "success" && data.data) {
      return data.data;
    }
    return [];
  }

  // Players API
  async getPlayerStats(playerId: number): Promise<PlayerStats | null> {
    const response = await fetch(`${PLAYERS_API}/${playerId}/stats`);
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

// Helper function to get API client with auth headers
export async function createAuthenticatedRequest(
  endpoint: string,
  options: RequestInit = {}
) {
  const authHeaders = await getClientAuthHeaders();

  return fetch(`${API_BASE}${endpoint}`, {
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
