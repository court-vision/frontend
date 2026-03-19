import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { NBATeamStatsData, NBATeamRosterData } from "@/types/nba-team";
import type { NBATeamLiveGameData } from "@/types/games";

export const nbaTeamKeys = {
  all: ["nba-team"] as const,
  stats: (abbrev: string) => [...nbaTeamKeys.all, "stats", abbrev] as const,
  roster: (abbrev: string) => [...nbaTeamKeys.all, "roster", abbrev] as const,
  liveGame: (abbrev: string) => [...nbaTeamKeys.all, "live-game", abbrev] as const,
};

export function useNBATeamStatsQuery(abbrev: string | null) {
  return useQuery<NBATeamStatsData | null>({
    queryKey: nbaTeamKeys.stats(abbrev!),
    queryFn: () => apiClient.getNBATeamStats(abbrev!),
    enabled: !!abbrev,
    staleTime: 1000 * 60 * 30, // 30 minutes — stats update post-game
  });
}

export function useNBATeamRosterQuery(abbrev: string | null) {
  return useQuery<NBATeamRosterData | null>({
    queryKey: nbaTeamKeys.roster(abbrev!),
    queryFn: () => apiClient.getNBATeamRoster(abbrev!),
    enabled: !!abbrev,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function useNBATeamLiveGameQuery(abbrev: string | null) {
  return useQuery<NBATeamLiveGameData | null>({
    queryKey: nbaTeamKeys.liveGame(abbrev!),
    queryFn: () => apiClient.getNBATeamLiveGame(abbrev!),
    enabled: !!abbrev,
    staleTime: 0,
    refetchInterval: 1000 * 60, // 60 seconds — matches live pipeline cadence
    refetchOnWindowFocus: true,
  });
}
