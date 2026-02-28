import { useQuery } from "@tanstack/react-query";
import { BREAKOUT_API } from "@/endpoints";
import type { BreakoutData, BreakoutResponse } from "@/types/breakout";

export const breakoutKeys = {
  all: ["breakout-streamers"] as const,
  list: (limit: number) => [...breakoutKeys.all, limit] as const,
};

export function useBreakoutStreamersQuery(limit: number = 30) {
  return useQuery({
    queryKey: breakoutKeys.list(limit),
    queryFn: async (): Promise<BreakoutData | null> => {
      const response = await fetch(`${BREAKOUT_API}/?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`Breakout API failed: ${response.statusText}`);
      }
      const data: BreakoutResponse = await response.json();
      if (data.status === "success" && data.data) {
        return data.data;
      }
      return null;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes — pipeline runs once daily
    refetchOnWindowFocus: false,
  });
}
