import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";
import type { LeagueInfo } from "@/types/team";
import type { StreamerData } from "@/types/streamer";

// Query keys
export const streamersKeys = {
  all: ["streamers"] as const,
  find: (teamId: number, day?: number | null) =>
    [...streamersKeys.all, "find", teamId, day] as const,
};

// Hooks
export function useStreamersQuery(
  leagueInfo: LeagueInfo | null,
  teamId: number | null,
  options?: {
    faCount?: number;
    excludeInjured?: boolean;
    b2bOnly?: boolean;
    day?: number | null;
  }
) {
  const { getToken, isSignedIn } = useAuth();
  const { faCount = 50, excludeInjured = true, b2bOnly = false, day = null } = options || {};

  return useQuery({
    queryKey: streamersKeys.find(teamId!, day),
    queryFn: async (): Promise<StreamerData> => {
      const response = await apiClient.findStreamers(getToken, {
        league_info: leagueInfo!,
        fa_count: faCount,
        exclude_injured: excludeInjured,
        b2b_only: b2bOnly,
        day: day,
      });
      if (response.status === "success" && response.data) {
        return response.data;
      }
      throw new Error(response.message || "Failed to find streamers");
    },
    enabled: !!leagueInfo && !!teamId && isSignedIn === true,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
