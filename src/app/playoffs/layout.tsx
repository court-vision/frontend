import type { Metadata } from "next";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/nextjs";
import { apiClient } from "@/lib/api";
import { playoffKeys } from "@/hooks/usePlayoff";

export const metadata: Metadata = {
  title: "NBA Playoff Bracket",
  description: "The current NBA playoff bracket, series leaders, and results, updated nightly.",
};

export default async function PlayoffsLayout({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: playoffKeys.bracket(),
    queryFn: () => apiClient.getPlayoffBracket(),
    staleTime: 1000 * 60 * 60,
  });
  const error = queryClient.getQueryState(playoffKeys.bracket())?.error;
  if (error) Sentry.captureException(error, { tags: { prefetch: "playoffs" } });

  return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>;
}
