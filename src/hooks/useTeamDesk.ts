import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";
import type { LeagueProjectionData, LeagueValuesData, StreamingLineData, ValueWindowKey } from "@/types/team-desk";

export const teamDeskKeys = {
  all: ["team-desk"] as const,
  projections: (teamId: number) => [...teamDeskKeys.all, teamId, "projections"] as const,
  values: (teamId: number, window: ValueWindowKey) => [...teamDeskKeys.all, teamId, "values", window] as const,
  line: (teamId: number, window: ValueWindowKey) => [...teamDeskKeys.all, teamId, "line", window] as const,
};

/**
 * The Team desk's reads. Each one reads the whole league from ESPN (about a second, the line a
 * second or two more per matchup) and none of it moves faster than the night's games, so they are
 * kept for minutes, not polled, and not read again when the tab comes back. A window change keeps
 * the last window's answer on screen until the new one lands.
 */
const KEEP_MS = 10 * 60_000;

export function useLeagueProjectionsQuery(teamId: number | null, enabled = true) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<LeagueProjectionData>({
    queryKey: teamDeskKeys.projections(teamId!),
    queryFn: ({ signal }) => apiClient.getLeagueProjections(getToken, teamId!, { signal }),
    enabled: enabled && !!teamId && isSignedIn === true,
    staleTime: 5 * 60_000,
    gcTime: KEEP_MS,
    // The desk shows its own failure in place.
    meta: { toast: false },
  });
}

export function useLeagueValuesQuery(teamId: number | null, window: ValueWindowKey, enabled = true) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<LeagueValuesData>({
    queryKey: teamDeskKeys.values(teamId!, window),
    queryFn: ({ signal }) => apiClient.getLeagueValues(getToken, teamId!, window, { signal }),
    enabled: enabled && !!teamId && isSignedIn === true,
    staleTime: KEEP_MS,
    gcTime: KEEP_MS,
    placeholderData: (prev, query) => (query?.queryKey[1] === teamId ? keepPreviousData(prev) : undefined),
    meta: { toast: false },
  });
}

export function useStreamingLineQuery(teamId: number | null, window: ValueWindowKey | null, enabled = true) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<StreamingLineData>({
    queryKey: teamDeskKeys.line(teamId!, window!),
    queryFn: ({ signal }) => apiClient.getStreamingLine(getToken, teamId!, window!, { signal }),
    enabled: enabled && !!teamId && !!window && isSignedIn === true,
    staleTime: KEEP_MS,
    gcTime: KEEP_MS,
    placeholderData: (prev, query) => (query?.queryKey[1] === teamId ? keepPreviousData(prev) : undefined),
    meta: { toast: false },
  });
}
