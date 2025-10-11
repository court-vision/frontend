import { getClientAuthHeaders } from "./auth";
import { BACKEND_ENDPOINT } from "@/endpoints";
import type { Team, RosterPlayer, LeagueInfoRequest } from "@/types/team";
import type { Lineup, LineupGenerationRequest } from "@/types/lineup";
import type { StandingsPlayer, StandingsPlayerStats } from "@/types/standings";
import type { RankingsPlayer } from "@/types/rankings";

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

  // Teams API
  async getTeams(): Promise<Team[]> {
    return this.request<Team[]>("/db/teams");
  }

  async addTeam(teamData: LeagueInfoRequest): Promise<Team> {
    return this.request<Team>("/db/teams", {
      method: "POST",
      body: JSON.stringify(teamData),
    });
  }

  async updateTeam(teamId: number, teamData: LeagueInfoRequest): Promise<Team> {
    return this.request<Team>(`/db/teams/${teamId}`, {
      method: "PUT",
      body: JSON.stringify(teamData),
    });
  }

  async deleteTeam(teamId: number): Promise<void> {
    await this.request<void>(`/db/teams/${teamId}`, {
      method: "DELETE",
    });
  }

  async getTeamRoster(teamId: number): Promise<RosterPlayer[]> {
    return this.request<RosterPlayer[]>(`/view-team?team_id=${teamId}`);
  }

  // Lineups API
  async getLineups(teamId: number): Promise<Lineup[]> {
    return this.request<Lineup[]>(`/lineups?selected_team=${teamId}`);
  }

  async generateLineup(data: LineupGenerationRequest): Promise<Lineup> {
    return this.request<Lineup>("/lineups", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async saveLineup(lineup: Lineup): Promise<Lineup> {
    return this.request<Lineup>("/lineups", {
      method: "PUT",
      body: JSON.stringify(lineup),
    });
  }

  async deleteLineup(lineupId: number): Promise<void> {
    await this.request<void>("/lineups", {
      method: "DELETE",
      body: JSON.stringify({ lineupId }),
    });
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
