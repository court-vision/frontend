import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export const scheduleKeys = {
  all: ["schedule"] as const,
  weeks: () => [...scheduleKeys.all, "weeks"] as const,
};

// Hooks
export function useScheduleWeeksQuery() {
  return useQuery({
    queryKey: scheduleKeys.weeks(),
    queryFn: () => apiClient.getScheduleWeeks(),
    staleTime: 1000 * 60 * 60, // 1 hour - schedule doesn't change
  });
}

