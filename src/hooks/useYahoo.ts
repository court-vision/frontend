import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";
import type { YahooLeague, YahooTeam } from "@/types/yahoo";

export const yahooKeys = {
  all: ["yahoo"] as const,
  authUrl: () => [...yahooKeys.all, "authUrl"] as const,
  leagues: (connectionId: string) =>
    [...yahooKeys.all, "leagues", connectionId] as const,
  teams: (connectionId: string, leagueKey: string) =>
    [...yahooKeys.all, "teams", connectionId, leagueKey] as const,
};

export function useYahooAuthUrl() {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: yahooKeys.authUrl(),
    queryFn: () => apiClient.getYahooAuthUrl(getToken),
    enabled: false, // Only fetch when explicitly triggered via refetch()
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useYahooLeagues(connectionId: number | null) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<YahooLeague[]>({
    queryKey: yahooKeys.leagues(String(connectionId ?? "")),
    queryFn: () => apiClient.getYahooLeagues(getToken, connectionId!),
    enabled: !!connectionId && isSignedIn === true,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useYahooTeams(
  connectionId: number | null,
  leagueKey: string | null
) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<YahooTeam[]>({
    queryKey: yahooKeys.teams(String(connectionId ?? ""), leagueKey || ""),
    queryFn: () => apiClient.getYahooTeams(getToken, connectionId!, leagueKey!),
    enabled: !!connectionId && !!leagueKey && isSignedIn === true,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
