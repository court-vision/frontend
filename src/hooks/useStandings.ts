import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

// Query keys
export const standingsKeys = {
  all: ["standings"] as const,
  lists: () => [...standingsKeys.all, "list"] as const,
};

// Hooks
export function useStandingsQuery() {
  return useQuery({
    queryKey: standingsKeys.lists(),
    queryFn: () => apiClient.getStandings(),
    staleTime: 1000 * 60 * 10, // 10 minutes - standings don't change often
  });
}
