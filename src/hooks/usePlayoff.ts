import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export const playoffKeys = {
  all: ["playoff"] as const,
  bracket: (season?: string) => [...playoffKeys.all, "bracket", season] as const,
};

export function usePlayoffBracketQuery(season?: string) {
  return useQuery({
    queryKey: playoffKeys.bracket(season),
    queryFn: () => apiClient.getPlayoffBracket(season),
    staleTime: 1000 * 60 * 60, // 1 hour — updated once nightly
    refetchOnWindowFocus: false,
  });
}
