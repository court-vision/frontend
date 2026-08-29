import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { scoringLabel } from "@/lib/category-format";
import { useUIStore } from "@/stores/useUIStore";
import { matchupKeys } from "@/hooks/useMatchup";
import { rankingsKeys } from "@/hooks/useRankings";
import type { LeagueInfoRequest } from "@/types/team";

import type { TeamInsightsData } from "@/types/team-insights";

// Query keys
export const teamsKeys = {
  all: ["teams"] as const,
  lists: () => [...teamsKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...teamsKeys.lists(), { filters }] as const,
  details: () => [...teamsKeys.all, "detail"] as const,
  detail: (id: number) => [...teamsKeys.details(), id] as const,
  rosters: () => [...teamsKeys.all, "roster"] as const,
  roster: (teamId: number) => [...teamsKeys.rosters(), teamId] as const,
  insights: (teamId: number) => [...teamsKeys.all, "insights", teamId] as const,
  league: (teamId: number) => [...teamsKeys.all, "league", teamId] as const,
};

// Hooks
export function useTeamsQuery() {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: teamsKeys.lists(),
    queryFn: () => apiClient.getTeams(getToken),
    enabled: isSignedIn === true,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useTeamRosterQuery(teamId: number | null) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: teamsKeys.roster(teamId!),
    queryFn: () => apiClient.getTeamRoster(getToken, teamId!),
    enabled: !!teamId && isSignedIn === true,
    staleTime: 1000 * 60 * 2, // 2 minutes for roster data
  });
}

export function useTeamInsightsQuery(teamId: number | null) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<TeamInsightsData>({
    queryKey: teamsKeys.insights(teamId!),
    queryFn: () => apiClient.getTeamInsights(getToken, teamId!),
    enabled: !!teamId && isSignedIn === true,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

/** Full provider-detected league settings (null until the league has been synced). */
export function useTeamLeagueQuery(teamId: number | null) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: teamsKeys.league(teamId!),
    queryFn: () => apiClient.getTeamLeague(getToken, teamId!),
    enabled: !!teamId && isSignedIn === true,
    staleTime: 1000 * 60 * 5,
  });
}

// Mutations
export function useAddTeamMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: (teamData: LeagueInfoRequest) =>
      apiClient.addTeam(getToken, teamData),
    onSuccess: (response) => {
      if (response.status === "success") {
        const league = response.data?.league ?? null;
        const format = league?.settings_synced ? scoringLabel(league) : null;
        if (response.already_exists) {
          toast.info("Team already exists in your account.");
        } else {
          toast.success(
            format
              ? `Team added — detected ${format}.`
              : "Team added successfully!"
          );
        }
        const newTeamId = response.team_id ?? response.data?.team_id ?? null;
        if (newTeamId) {
          useUIStore.getState().setSelectedTeam(newTeamId);
        }
        queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
      } else {
        toast.error(response.message || "Failed to add team.");
      }
    },
    onError: (error) => {
      console.error("Add team error:", error);
    },
  });
}

export function useUpdateTeamMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: ({
      teamId,
      teamData,
    }: {
      teamId: number;
      teamData: LeagueInfoRequest;
    }) => apiClient.updateTeam(getToken, teamId, teamData),
    onSuccess: (response, { teamId }) => {
      if (response.status === "success") {
        toast.success("Team updated successfully!");
        queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
        queryClient.invalidateQueries({ queryKey: teamsKeys.detail(teamId) });
        queryClient.invalidateQueries({ queryKey: teamsKeys.roster(teamId) });
        queryClient.invalidateQueries({ queryKey: teamsKeys.league(teamId) });
      } else {
        toast.error(response.message || "Failed to update team.");
      }
    },
    onError: (error) => {
      console.error("Update team error:", error);
    },
  });
}

export function useDeleteTeamMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: (teamId: number) => apiClient.deleteTeam(getToken, teamId),
    onSuccess: (response, teamId) => {
      if (response.status === "success") {
        toast.success("Team removed successfully!");
        if (useUIStore.getState().selectedTeam === teamId) {
          useUIStore.getState().setSelectedTeam(null);
        }
        queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
        queryClient.removeQueries({ queryKey: teamsKeys.detail(teamId) });
        queryClient.removeQueries({ queryKey: teamsKeys.roster(teamId) });
        queryClient.removeQueries({ queryKey: teamsKeys.league(teamId) });
      } else {
        toast.error(response.message || "Failed to remove team.");
      }
    },
    onError: (error) => {
      console.error("Delete team error:", error);
    },
  });
}

/** Re-sync a team's league settings from ESPN/Yahoo. */
export function useSyncTeamLeagueMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: (teamId: number) => apiClient.syncTeamLeague(getToken, teamId),
    onSuccess: (response, teamId) => {
      if (response.status === "success" && response.data) {
        toast.success(`League settings synced — ${scoringLabel(response.data)}.`);
      } else {
        toast.warning(response.message || "Could not sync league settings.");
      }
      queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: teamsKeys.league(teamId) });
      queryClient.invalidateQueries({ queryKey: teamsKeys.insights(teamId) });
      queryClient.invalidateQueries({ queryKey: matchupKeys.all });
      // A re-sync changes the weights and categories league-scored rankings are
      // computed from, so the cached ones are now wrong rather than merely stale.
      queryClient.invalidateQueries({ queryKey: rankingsKeys.all });
    },
    onError: (error) => {
      console.error("Sync league error:", error);
    },
  });
}
