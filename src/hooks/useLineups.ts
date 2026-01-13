import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
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
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: lineupsKeys.list(teamId!),
    queryFn: () => apiClient.getLineups(getToken, teamId!),
    enabled: !!teamId && isSignedIn === true,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Mutations
export function useGenerateLineupMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: (data: LineupGenerationRequest) =>
      apiClient.generateLineup(getToken, data),
    onSuccess: (response, variables) => {
      if (response.status === "success") {
        // toast.success("Lineup generated successfully!");
        queryClient.invalidateQueries({
          queryKey: lineupsKeys.list(variables.team_id),
        });
      } else {
        // toast.error(response.message || "Failed to generate lineup.");
      }
    },
    onError: (error) => {
      console.error("Generate lineup error:", error);
      // toast.error("Failed to generate lineup. Please try again.");
    },
  });
}

export function useSaveLineupMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: ({ teamId, lineup }: { teamId: number; lineup: Lineup }) =>
      apiClient.saveLineup(getToken, teamId, lineup),
    onSuccess: (response) => {
      if (response.status === "success") {
        toast.success("Lineup saved successfully!");
        queryClient.invalidateQueries({ queryKey: lineupsKeys.lists() });
      } else if (response.already_exists) {
        toast.error("This lineup has already been saved.");
      } else {
        toast.error(response.message || "Failed to save lineup.");
      }
    },
    onError: (error) => {
      console.error("Save lineup error:", error);
      toast.error("Failed to save lineup. Please try again.");
    },
  });
}

export function useDeleteLineupMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: (lineupId: number) => apiClient.deleteLineup(getToken, lineupId),
    onSuccess: (response, lineupId) => {
      if (response.status === "success") {
        toast.success("Lineup deleted successfully!");
        queryClient.invalidateQueries({ queryKey: lineupsKeys.lists() });
        queryClient.removeQueries({ queryKey: lineupsKeys.detail(lineupId) });
      } else {
        toast.error(response.message || "Failed to delete lineup.");
      }
    },
    onError: (error) => {
      console.error("Delete lineup error:", error);
      toast.error("Failed to delete lineup. Please try again.");
    },
  });
}
