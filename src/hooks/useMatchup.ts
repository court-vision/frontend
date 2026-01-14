import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";
import type { AvgWindow } from "@/types/matchup";

// Query keys
export const matchupKeys = {
  all: ["matchups"] as const,
  details: () => [...matchupKeys.all, "detail"] as const,
  detail: (teamId: number, avgWindow: AvgWindow) =>
    [...matchupKeys.details(), teamId, avgWindow] as const,
};

// Hooks
export function useMatchupQuery(
  teamId: number | null,
  avgWindow: AvgWindow = "season"
) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: matchupKeys.detail(teamId!, avgWindow),
    queryFn: () => apiClient.getMatchup(getToken, teamId!, avgWindow),
    enabled: !!teamId && isSignedIn === true,
    staleTime: 1000 * 60 * 2, // 2 minutes - matchup data changes during games
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}
