import type { Metadata } from "next";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/nextjs";
import { apiClient } from "@/lib/api";
import { rankingsKeys } from "@/hooks/useRankings";
import { DEFAULT_RANKINGS_PARAMS } from "@/lib/rankings-params";

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

  // Prefetch only the points/season variant: it is what the static HTML
  // shows (crawlers, first paint); category views load on the client.
  await queryClient.prefetchQuery({
    queryKey: rankingsKeys.list(DEFAULT_RANKINGS_PARAMS),
    queryFn: () => apiClient.getRankingsWithMeta(DEFAULT_RANKINGS_PARAMS),
    staleTime: 1000 * 60 * 10,
  });

  // prefetchQuery never throws; a failure here means Vercel could not reach the API.
  const prefetchError = queryClient.getQueryState(
    rankingsKeys.list(DEFAULT_RANKINGS_PARAMS)
  )?.error;
  if (prefetchError) {
    Sentry.captureException(prefetchError, { tags: { prefetch: "rankings" } });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
