import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type {
  RosterPlayer,
  LeagueInfoRequest,
  TeamResponseData,
} from "@/types/team";

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
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: teamsKeys.lists(),
    queryFn: () => apiClient.getTeams(getToken),
    enabled: isSignedIn === true,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useTeamQuery(teamId: number | null) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: teamsKeys.detail(teamId!),
    queryFn: () => apiClient.getTeamRoster(getToken, teamId!),
    enabled: !!teamId && isSignedIn === true,
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

// Mutations
export function useAddTeamMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: (teamData: LeagueInfoRequest) =>
      apiClient.addTeam(getToken, teamData),
    onSuccess: (response) => {
      if (response.status === "success") {
        if (response.already_exists) {
          toast.info("Team already exists in your account.");
        } else {
          toast.success("Team added successfully!");
        }
        queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
      } else {
        toast.error(response.message || "Failed to add team.");
      }
    },
    onError: (error) => {
      console.error("Add team error:", error);
      toast.error("Failed to add team. Please try again.");
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
      } else {
        toast.error(response.message || "Failed to update team.");
      }
    },
    onError: (error) => {
      console.error("Update team error:", error);
      toast.error("Failed to update team. Please try again.");
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
        queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
        queryClient.removeQueries({ queryKey: teamsKeys.detail(teamId) });
        queryClient.removeQueries({ queryKey: teamsKeys.roster(teamId) });
      } else {
        toast.error(response.message || "Failed to remove team.");
      }
    },
    onError: (error) => {
      console.error("Delete team error:", error);
      toast.error("Failed to remove team. Please try again.");
    },
  });
}
