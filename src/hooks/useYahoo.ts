import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";
import type { YahooLeague, YahooTeam } from "@/types/yahoo";

export const yahooKeys = {
  all: ["yahoo"] as const,
  authUrl: () => [...yahooKeys.all, "authUrl"] as const,
  leagues: (accessToken: string) =>
    [...yahooKeys.all, "leagues", accessToken] as const,
  teams: (accessToken: string, leagueKey: string) =>
    [...yahooKeys.all, "teams", accessToken, leagueKey] as const,
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

export function useYahooLeagues(accessToken: string | null) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<YahooLeague[]>({
    queryKey: yahooKeys.leagues(accessToken || ""),
    queryFn: () => apiClient.getYahooLeagues(getToken, accessToken!),
    enabled: !!accessToken && isSignedIn === true,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useYahooTeams(
  accessToken: string | null,
  leagueKey: string | null
) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<YahooTeam[]>({
    queryKey: yahooKeys.teams(accessToken || "", leagueKey || ""),
    queryFn: () => apiClient.getYahooTeams(getToken, accessToken!, leagueKey!),
    enabled: !!accessToken && !!leagueKey && isSignedIn === true,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
