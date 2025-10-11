import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Lineup, LineupGenerationRequest } from "@/types/lineup";

// Query keys
export const lineupsKeys = {
  all: ["lineups"] as const,
  lists: () => [...lineupsKeys.all, "list"] as const,
  list: (teamId: number) => [...lineupsKeys.lists(), teamId] as const,
  details: () => [...lineupsKeys.all, "detail"] as const,
  detail: (id: number) => [...lineupsKeys.details(), id] as const,
};

// Hooks
export function useLineupsQuery(teamId: number | null) {
  return useQuery({
    queryKey: lineupsKeys.list(teamId!),
    queryFn: () => apiClient.getLineups(teamId!),
    enabled: !!teamId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Mutations
export function useGenerateLineupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LineupGenerationRequest) =>
      apiClient.generateLineup(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: lineupsKeys.list(variables.selected_team),
      });
    },
  });
}

export function useSaveLineupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lineup: Lineup) => apiClient.saveLineup(lineup),
    onSuccess: (savedLineup) => {
      queryClient.invalidateQueries({ queryKey: lineupsKeys.lists() });
      queryClient.setQueryData(lineupsKeys.detail(savedLineup.Id), savedLineup);
    },
  });
}

export function useDeleteLineupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lineupId: number) => apiClient.deleteLineup(lineupId),
    onSuccess: (_, lineupId) => {
      queryClient.invalidateQueries({ queryKey: lineupsKeys.lists() });
      queryClient.removeQueries({ queryKey: lineupsKeys.detail(lineupId) });
    },
  });
}
