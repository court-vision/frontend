"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";

import { sessionTitle } from "@/lib/draft-session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { QueryErrorState } from "@/components/ui/query-error";
import { RecapView } from "@/components/draft/RecapView";
import { useDraftRecapQuery, useDraftSessionQuery } from "@/hooks/useDrafts";
import { PageHeader } from "@/components/PageHeader";

/**
 * The finished draft, read back: seats graded against each other, every pick
 * priced against the board it was drafted from, the standings projected. A
 * report, not a room. The view underneath reads the recap query and nothing
 * else, so a public share (Phase 3) can render it without a session.
 */
export default function DraftRecapPage({ sessionId }: { sessionId: number }) {
  const { isSignedIn, isLoaded } = useUser();
  const { data: session } = useDraftSessionQuery(sessionId);
  const { data: recap, isLoading, error, refetch, isFetching } = useDraftRecapQuery(sessionId);

  const meta = recap?.meta ?? null;
  const subtitle = meta
    ? [
        meta.format,
        meta.draft_type,
        meta.league_size ? `${meta.league_size} teams` : null,
        `${meta.picks_made}${meta.total_picks ? ` / ${meta.total_picks}` : ""} picks`,
        session?.espn_league_id != null ? `ESPN ${session.espn_league_id}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Reading the draft back...";

  const header = (
    <PageHeader
      title={
        <>
          {session ? sessionTitle(session) : `Draft #${sessionId}`}
          <span className="ml-2 text-base font-normal text-muted-foreground">recap</span>
        </>
      }
      subtitle={<span className="font-mono text-xs">{subtitle}</span>}
      actions={
        <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
          <Link href={`/draft/${sessionId}`}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Room
          </Link>
        </Button>
      }
    />
  );

  if (!isLoaded || (isSignedIn && isLoading)) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {header}
        <Skeleton className="h-[96px] w-full rounded-md" />
        <Card variant="panel" className="p-2">
          <SkeletonTable rows={10} columns={8} />
        </Card>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {header}
        <Card variant="panel" className="p-8">
          <p className="text-center text-sm text-muted-foreground">
            Please sign in to read this draft&apos;s recap.
          </p>
        </Card>
      </div>
    );
  }

  if (error || !recap) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {header}
        <Card variant="panel">
          <QueryErrorState
            error={error}
            onRetry={() => refetch()}
            isRetrying={isFetching}
            fallback="This recap could not be loaded."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up-fade">
      {header}
      <RecapView recap={recap} />
    </div>
  );
}
