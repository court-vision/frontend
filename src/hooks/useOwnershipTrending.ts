import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { OwnershipTrendingParams } from "@/types/ownership";

// Query keys
export const ownershipKeys = {
  all: ["ownership"] as const,
  trending: (params?: OwnershipTrendingParams) =>
    [...ownershipKeys.all, "trending", params] as const,
};

// Hooks
export function useOwnershipTrendingQuery(params: OwnershipTrendingParams = {}) {
  return useQuery({
    queryKey: ownershipKeys.trending(params),
    queryFn: () => apiClient.getOwnershipTrending(params),
    staleTime: 1000 * 60 * 5, // 5 minutes - ownership changes throughout the day
  });
}
