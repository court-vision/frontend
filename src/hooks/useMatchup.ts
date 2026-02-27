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
  history: () => [...matchupKeys.all, "history"] as const,
  historyDetail: (teamId: number, matchupPeriod?: number) =>
    [...matchupKeys.history(), teamId, matchupPeriod] as const,
  live: (teamId: number) => [...matchupKeys.all, "live", teamId] as const,
  daily: (teamId: number, date: string) =>
    [...matchupKeys.all, "daily", teamId, date] as const,
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

export function useLiveMatchupQuery(teamId: number | null) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: matchupKeys.live(teamId!),
    queryFn: () => apiClient.getLiveMatchup(getToken, teamId!),
    enabled: !!teamId && isSignedIn === true,
    staleTime: 0,
    refetchInterval: 60 * 1000, // Poll every 60s in sync with the live pipeline
    refetchOnWindowFocus: true,
  });
}

export function useDailyMatchupQuery(
  teamId: number | null,
  date: string | null
) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: matchupKeys.daily(teamId!, date!),
    queryFn: () => apiClient.getDailyMatchup(getToken, teamId!, date!),
    enabled: !!teamId && !!date && isSignedIn === true,
    staleTime: 1000 * 60 * 10, // 10 minutes - historical data is stable
  });
}

export function useMatchupScoreHistoryQuery(
  teamId: number | null,
  matchupPeriod?: number
) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: matchupKeys.historyDetail(teamId!, matchupPeriod),
    queryFn: () => apiClient.getMatchupScoreHistory(getToken, teamId!, matchupPeriod),
    enabled: !!teamId && isSignedIn === true,
    staleTime: 1000 * 60 * 5, // 5 minutes - historical data doesn't change often
  });
}
