import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";
import type { BreakoutData } from "@/types/breakout";

export const breakoutKeys = {
  all: ["breakout-streamers"] as const,
  list: (limit: number) => [...breakoutKeys.all, limit] as const,
};

export function useBreakoutStreamersQuery(limit: number = 30) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: breakoutKeys.list(limit),
    queryFn: (): Promise<BreakoutData | null> =>
      apiClient.getBreakoutStreamers(getToken, limit),
    staleTime: 1000 * 60 * 30, // 30 minutes — pipeline runs once daily
    refetchOnWindowFocus: false,
  });
}
