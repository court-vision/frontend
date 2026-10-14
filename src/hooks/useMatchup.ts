import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";
import { livePollMs, type Span } from "@/lib/week-polling";
import type { AvgWindow, LiveMatchupData } from "@/types/matchup";

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
  week: (teamId: number) => [...matchupKeys.all, "week", teamId] as const,
  seasonSummary: (teamId: number) => [...matchupKeys.all, "season-summary", teamId] as const,
};

// Hooks
export function useMatchupQuery(
  teamId: number | null,
  avgWindow: AvgWindow = "season",
  opts: { enabled?: boolean } = {}
) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: matchupKeys.detail(teamId!, avgWindow),
    queryFn: ({ signal }) => apiClient.getMatchup(getToken, teamId!, avgWindow, { signal }),
    enabled: (opts.enabled ?? true) && !!teamId && isSignedIn === true,
    staleTime: 1000 * 60 * 2, // 2 minutes - matchup data changes during games
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}

/**
 * The current matchup with tonight's box scores on top. It polls fast only
 * around rostered games (`span`, from today's board, and any live box score in
 * its own answer) and every few minutes otherwise; see `livePollMs`. A return
 * to the tab reads it again once it is 30 s old.
 */
export function useLiveMatchupQuery(teamId: number | null, span: Span | null = null) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery<LiveMatchupData>({
    queryKey: matchupKeys.live(teamId!),
    queryFn: ({ signal }) => apiClient.getLiveMatchup(getToken, teamId!, { signal }),
    enabled: !!teamId && isSignedIn === true,
    staleTime: 30_000,
    refetchInterval: (query) => livePollMs(span, query.state.data, Date.now()),
    refetchOnWindowFocus: true,
    // Live polling: the next poll is the retry (the Week desk reads /matchups/current
    // meanwhile), and the panel shows its own badge
    retry: false,
    meta: { toast: false },
  });
}

/**
 * Fetches all days in the current matchup period in a single request.
 * Replaces the N-parallel getDailyMatchup batch in MatchupPanel.
 *
 * After the data loads, each day is seeded into the individual daily query
 * cache so DailyBreakdownPanel gets instant cache hits when the user selects
 * any day.
 */
export function useWeeklyMatchupQuery(teamId: number | null) {
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: matchupKeys.week(teamId!),
    queryFn: () => apiClient.getWeeklyMatchup(getToken, teamId!),
    enabled: !!teamId && isSignedIn === true,
    staleTime: 1000 * 60 * 10, // 10 minutes - same as individual daily queries
    refetchOnWindowFocus: true,
  });

  // Seed per-day cache so DailyBreakdownPanel gets instant hits for any date
  useEffect(() => {
    if (!query.data || !teamId) return;
    query.data.days.forEach((day) => {
      const key = matchupKeys.daily(teamId, day.date);
      // Only seed if there's no fresher data already cached
      if (!queryClient.getQueryState(key)?.data) {
        queryClient.setQueryData(key, day);
      }
    });
  }, [query.data, teamId, queryClient]);

  return query;
}


/**
 * Both teams' running totals at each night's snapshot of one matchup period
 * (the Week desk's Edge race). A snapshot lands once a night after ESPN's
 * scores settle, so this is slow-moving; null before the period's first one.
 */
export function useMatchupScoreHistoryQuery(teamId: number | null, matchupPeriod: number | null) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: matchupKeys.historyDetail(teamId!, matchupPeriod ?? undefined),
    queryFn: ({ signal }) => apiClient.getMatchupScoreHistory(getToken, teamId!, matchupPeriod!, { signal }),
    enabled: !!teamId && matchupPeriod != null && isSignedIn === true,
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: true,
    meta: { toast: false },
  });
}
