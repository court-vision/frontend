import type { Metadata } from "next";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { rankingsKeys } from "@/hooks/useRankings";

export const metadata: Metadata = {
  title: "Player Rankings",
  description:
    "Fantasy basketball player rankings updated daily. Sort by total fantasy points, per-game averages, and category breakdowns to find the best players for your lineup.",
  openGraph: {
    title: "Player Rankings | Court Vision",
    description:
      "Fantasy basketball player rankings updated daily. Sort by total fantasy points, per-game averages, and category breakdowns to find the best players for your lineup.",
    url: "https://www.courtvision.dev/rankings",
  },
  twitter: {
    title: "Player Rankings | Court Vision",
    description:
      "Fantasy basketball player rankings updated daily. Sort by total fantasy points, per-game averages, and category breakdowns to find the best players for your lineup.",
  },
};

export default async function RankingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: rankingsKeys.lists(),
    queryFn: () => apiClient.getRankings(),
    staleTime: 1000 * 60 * 10,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
