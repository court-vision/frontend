import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Team, RosterPlayer, LeagueInfoRequest } from "@/types/team";

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
};

// Hooks
export function useTeamsQuery() {
  return useQuery({
    queryKey: teamsKeys.lists(),
    queryFn: () => apiClient.getTeams(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useTeamQuery(teamId: number | null) {
  return useQuery({
    queryKey: teamsKeys.detail(teamId!),
    queryFn: () => apiClient.getTeamRoster(teamId!),
    enabled: !!teamId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useTeamRosterQuery(teamId: number | null) {
  return useQuery({
    queryKey: teamsKeys.roster(teamId!),
    queryFn: () => apiClient.getTeamRoster(teamId!),
    enabled: !!teamId,
    staleTime: 1000 * 60 * 2, // 2 minutes for roster data
  });
}

// Mutations
export function useAddTeamMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamData: LeagueInfoRequest) => apiClient.addTeam(teamData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
    },
  });
}

export function useUpdateTeamMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      teamId,
      teamData,
    }: {
      teamId: number;
      teamData: LeagueInfoRequest;
    }) => apiClient.updateTeam(teamId, teamData),
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: teamsKeys.detail(teamId) });
      queryClient.invalidateQueries({ queryKey: teamsKeys.roster(teamId) });
    },
  });
}

export function useDeleteTeamMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamId: number) => apiClient.deleteTeam(teamId),
    onSuccess: (_, teamId) => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
      queryClient.removeQueries({ queryKey: teamsKeys.detail(teamId) });
      queryClient.removeQueries({ queryKey: teamsKeys.roster(teamId) });
    },
  });
}
