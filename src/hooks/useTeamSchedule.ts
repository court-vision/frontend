import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { TeamScheduleData } from "@/types/games";

export const teamScheduleKeys = {
  all: ["teams", "schedule"] as const,
  byTeam: (team: string, upcoming: boolean, limit: number) =>
    [...teamScheduleKeys.all, team, upcoming, limit] as const,
};

export function useTeamScheduleQuery(
  teamAbbrev: string | null | undefined,
  upcoming: boolean = false,
  limit: number = 12
) {
  return useQuery<TeamScheduleData | null>({
    queryKey: teamScheduleKeys.byTeam(teamAbbrev!, upcoming, limit),
    queryFn: () => apiClient.getTeamSchedule(teamAbbrev!, upcoming, limit),
    enabled: !!teamAbbrev,
    staleTime: 1000 * 60 * 30, // 30 minutes - schedule changes infrequently
  });
}
