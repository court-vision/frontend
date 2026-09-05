"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ArrowRight, Swords } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-error";
import { CreateSessionDialog } from "@/components/draft/CreateSessionDialog";
import { useDraftSessionsQuery } from "@/hooks/useDrafts";
import type { DraftSession, DraftStatus } from "@/types/draft";

const STATUS_CLASSES: Record<DraftStatus, string> = {
  active: "border-green-500/40 bg-green-500/10 text-green-500",
  completed: "border-border bg-muted text-muted-foreground",
  abandoned: "border-border bg-muted text-muted-foreground/70",
};

function SessionCard({ session }: { session: DraftSession }) {
  const progress =
    session.total_picks && session.total_picks > 0
      ? Math.round((session.pick_count / session.total_picks) * 100)
      : null;

  return (
    <Link href={`/draft/${session.id}`} className="block">
      <Card
        variant="panel"
        className="group flex items-center gap-3 p-3 transition-colors hover:border-primary/40"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {session.kind === "mock" ? "Mock draft" : `Draft #${session.id}`}
            </span>
            <span
              className={cn(
                "shrink-0 rounded border px-1.5 text-[9px] uppercase",
                STATUS_CLASSES[session.status]
              )}
            >
              {session.status}
            </span>
            <span className="shrink-0 font-mono text-[9px] uppercase text-muted-foreground/60">
              {session.draft_type}
            </span>
          </div>

          <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <span>
              {session.pick_count}
              {session.total_picks ? ` / ${session.total_picks}` : ""} picks
            </span>
            {session.league_size && (
              <>
                <span className="text-border">·</span>
                <span>{session.league_size} teams</span>
              </>
            )}
            {session.my_slot ? (
              <>
                <span className="text-border">·</span>
                <span>slot {session.my_slot}</span>
              </>
            ) : (
              <>
                <span className="text-border">·</span>
                <span className="text-amber-500">no slot set</span>
              </>
            )}
            {progress !== null && (
              <>
                <span className="text-border">·</span>
                <span>{progress}%</span>
              </>
            )}
          </div>

          {/* A mock advances fifty picks at a time, so how far it has got is
              worth reading at a glance rather than doing arithmetic on. */}
          {progress !== null && session.status === "active" && (
            <div
              title={`${session.pick_count} of ${session.total_picks} picks made`}
              className="mt-1 h-0.5 w-full overflow-hidden rounded bg-muted"
            >
              <div
                className="h-full bg-primary/60 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </Card>
    </Link>
  );
}

export default function DraftSessions() {
  const { isSignedIn, isLoaded } = useUser();
  const { data: sessions = [], isLoading, error, refetch, isFetching } = useDraftSessionsQuery();

  const pageHeader = (
    <section className="flex items-center justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Draft Lab</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Your draft rooms — board, recommendations and pick tracking for draft day.
        </p>
      </div>
      {isSignedIn && <CreateSessionDialog />}
    </section>
  );

  if (!isLoaded || (isSignedIn && isLoading)) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {pageHeader}
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {pageHeader}
        <Card variant="panel" className="p-8">
          <p className="text-center text-sm text-muted-foreground">
            Please sign in to open a draft room.
          </p>
        </Card>
      </div>
    );
  }

  if (error && sessions.length === 0) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {pageHeader}
        <Card variant="panel">
          <QueryErrorState error={error} onRetry={() => refetch()} isRetrying={isFetching} />
        </Card>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {pageHeader}
        <Card variant="panel" className="flex flex-col items-center gap-2 p-8 text-center">
          <Swords className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-medium">No draft rooms yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Start one from a synced team and the draft type, pick order and rounds are prefilled
            from its league — you only confirm which seat is yours.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up-fade">
      {pageHeader}
      <div className="space-y-2">
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}
