import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";
import type { BreakoutData } from "@/types/breakout";

export const breakoutKeys = {
  all: ["breakout-streamers"] as const,
  list: (limit: number) => [...breakoutKeys.all, limit] as const,
};

export function useBreakoutStreamersQuery(limit: number = 30) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: breakoutKeys.list(limit),
    queryFn: (): Promise<BreakoutData | null> =>
      apiClient.getBreakoutStreamers(getToken, limit),
    staleTime: 1000 * 60 * 30, // 30 minutes — pipeline runs once daily
    refetchOnWindowFocus: false,
    // Pages render before Clerk resolves, so stay idle until there is a token:
    // `fetchJson` throws on a null one rather than sending an anonymous request.
    enabled: isSignedIn === true,
  });
}
