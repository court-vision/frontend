import type { Metadata } from "next";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/nextjs";
import { apiClient } from "@/lib/api";
import { rankingsKeys } from "@/hooks/useRankings";

export const metadata: Metadata = {
  title: "Analytics Terminal",
  description:
    "Bloomberg Terminal-inspired analytics for fantasy basketball. Deep-dive into player stats, trends, advanced metrics, and head-to-head comparisons.",
  openGraph: {
    title: "Analytics Terminal | Court Vision",
    description:
      "Bloomberg Terminal-inspired analytics for fantasy basketball. Deep-dive into player stats, trends, advanced metrics, and head-to-head comparisons.",
    url: "https://www.courtvision.dev/terminal",
  },
  twitter: {
    title: "Analytics Terminal | Court Vision",
    description:
      "Bloomberg Terminal-inspired analytics for fantasy basketball. Deep-dive into player stats, trends, advanced metrics, and head-to-head comparisons.",
  },
};

export default async function TerminalLayout({
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
  const error = queryClient.getQueryState(rankingsKeys.lists())?.error;
  if (error) Sentry.captureException(error, { tags: { prefetch: "terminal-rankings" } });

  return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>;
}
