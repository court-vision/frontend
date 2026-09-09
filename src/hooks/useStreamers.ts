import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";
import { DEFAULT_AVG_DAYS } from "@/components/streamers-components/StreamerFilterControls";
import type { StreamerData, StreamerMode } from "@/types/streamer";

export interface StreamersQueryOptions {
  faCount?: number;
  excludeInjured?: boolean;
  b2bOnly?: boolean;
  mode?: StreamerMode;
  targetDay?: number | null;
  avgDays?: number;
}

/**
 * The /streamers page's search, and the hook's defaults: the whole free-agent
 * pool, today's pickup. A caller that passes exactly these shares the page's
 * cache entry, so navigating there is instant.
 */
export const STREAMERS_PAGE_QUERY = {
  faCount: 300,
  excludeInjured: true,
  b2bOnly: false,
  mode: "daily",
  targetDay: null,
  avgDays: DEFAULT_AVG_DAYS,
} as const satisfies Required<StreamersQueryOptions>;

// Query keys
export const streamersKeys = {
  all: ["streamers"] as const,
  /** Every search for one team — the prefix to invalidate after a roster write. */
  team: (teamId: number) => [...streamersKeys.all, "find", teamId] as const,
  find: (
    teamId: number,
    faCount?: number,
    excludeInjured?: boolean,
    b2bOnly?: boolean,
    mode?: StreamerMode,
    targetDay?: number | null,
    avgDays?: number
  ) =>
    [
      ...streamersKeys.team(teamId),
      faCount,
      excludeInjured,
      b2bOnly,
      mode,
      targetDay,
      avgDays,
    ] as const,
};

// Hooks
export function useStreamersQuery(teamId: number | null, options?: StreamersQueryOptions) {
  const { getToken, isSignedIn } = useAuth();
  const {
    faCount = STREAMERS_PAGE_QUERY.faCount,
    excludeInjured = STREAMERS_PAGE_QUERY.excludeInjured,
    b2bOnly = STREAMERS_PAGE_QUERY.b2bOnly,
    mode = STREAMERS_PAGE_QUERY.mode,
    targetDay = STREAMERS_PAGE_QUERY.targetDay,
    avgDays = STREAMERS_PAGE_QUERY.avgDays,
  } = options || {};

  return useQuery({
    queryKey: streamersKeys.find(
      teamId!,
      faCount,
      excludeInjured,
      b2bOnly,
      mode,
      targetDay,
      avgDays
    ),
    queryFn: ({ signal }): Promise<StreamerData> =>
      apiClient.findStreamers(
        getToken,
        teamId!,
        {
          fa_count: faCount,
          exclude_injured: excludeInjured,
          b2b_only: b2bOnly,
          mode: mode,
          target_day: targetDay,
          avg_days: avgDays,
        },
        { signal }
      ),
    enabled: !!teamId && isSignedIn === true,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
