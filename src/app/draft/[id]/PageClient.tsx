"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-error";
import { DraftBoardTable } from "@/components/draft/DraftBoardTable";
import { RecommendationStrip } from "@/components/draft/RecommendationStrip";
import { RosterZone } from "@/components/draft/RosterZone";
import {
  useDraftBoardQuery,
  useDraftPickMutation,
  useDraftSessionQuery,
  useUndoDraftPickMutation,
} from "@/hooks/useDrafts";
import type { DraftBoardRow } from "@/types/draft";

/**
 * The draft room: recommendation strip on top, board in the centre, roster on
 * the right (design doc §3.1).
 *
 * WS4 ships the shell and the pick mutation that drives it. The search-first
 * pick input, one-keystroke marking, Cmd+Z undo, the keeper editor and the
 * `:draft` terminal command are workstream 5.
 */
export default function DraftRoom({ sessionId }: { sessionId: number }) {
  const { isSignedIn, isLoaded } = useUser();

  const {
    data: session,
    isLoading: sessionLoading,
    error: sessionError,
    refetch: refetchSession,
    isFetching: sessionFetching,
  } = useDraftSessionQuery(sessionId);
  const { data: board, isLoading: boardLoading, error: boardError } = useDraftBoardQuery(sessionId);

  const addPick = useDraftPickMutation(sessionId);
  const undoPick = useUndoDraftPickMutation(sessionId);

  const handlePick = useCallback(
    (row: DraftBoardRow, byMe: boolean) => {
      addPick.mutate(
        {
          player_id: row.player_id,
          espn_player_id: row.espn_id,
          player_name: row.name,
          by_me: byMe,
          source: "manual",
          overall_pick: null,
          bid: null,
        },
        {
          onSuccess: (pick) => {
            toast.success(
              byMe
                ? `You drafted ${row.name} at ${pick.overall_pick}`
                : `${row.name} off the board at ${pick.overall_pick}`
            );
          },
        }
      );
    },
    [addPick]
  );

  const handleRecommendationPick = useCallback(
    (playerId: number, name: string) => {
      const row = board?.rows.find((r) => r.player_id === playerId);
      if (row) {
        handlePick(row, true);
        return;
      }
      toast.error(`${name} is no longer on the board`);
    },
    [board, handlePick]
  );

  const header = (
    <section className="flex items-center justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {session?.kind === "mock" ? "Mock draft" : `Draft #${sessionId}`}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {session ? (
            <span className="font-mono text-xs">
              {session.draft_type}
              {session.league_size ? ` · ${session.league_size} teams` : ""}
              {session.my_slot ? ` · slot ${session.my_slot}` : " · no slot set"}
              {` · pick ${session.next_overall_pick}`}
              {session.picks_until_my_turn !== null && session.picks_until_my_turn !== undefined
                ? session.picks_until_my_turn === 0
                  ? " · you are on the clock"
                  : ` · ${session.picks_until_my_turn} until your turn`
                : ""}
            </span>
          ) : (
            "Loading the room..."
          )}
        </p>
      </div>
      <Link href="/draft">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
      </Link>
    </section>
  );

  if (!isLoaded || (isSignedIn && sessionLoading)) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {header}
        <Skeleton className="h-[120px] w-full rounded-md" />
        <Skeleton className="h-[420px] w-full rounded-md" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {header}
        <Card variant="panel" className="p-8">
          <p className="text-center text-sm text-muted-foreground">
            Please sign in to open this draft room.
          </p>
        </Card>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {header}
        <Card variant="panel">
          <QueryErrorState
            error={sessionError}
            onRetry={() => refetchSession()}
            isRetrying={sessionFetching}
            fallback="This draft room could not be loaded."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-slide-up-fade">
      {header}

      {/* Recommendation strip */}
      <Card variant="panel" className="overflow-hidden">
        <div className="border-b border-border/50 bg-muted/30 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Best available
          {session?.my_slot === null && (
            <span className="ml-2 normal-case tracking-normal text-amber-500">
              set your slot to see whose turn it is
            </span>
          )}
        </div>
        <RecommendationStrip
          recommendations={board?.recommendations ?? []}
          isLoading={boardLoading}
          onPick={handleRecommendationPick}
          isPicking={addPick.isPending}
        />
      </Card>

      {/* Board + roster */}
      <div className={cn("grid gap-3", "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px]")}>
        <Card variant="panel" className="h-[560px] overflow-hidden">
          {boardError ? (
            <QueryErrorState error={boardError} fallback="The board could not be loaded." />
          ) : (
            <DraftBoardTable
              rows={board?.rows ?? []}
              meta={board?.meta ?? null}
              message={board?.message ?? ""}
              isLoading={boardLoading}
              onPick={handlePick}
              isPicking={addPick.isPending}
            />
          )}
        </Card>

        <Card variant="panel" className="h-[560px] overflow-hidden">
          <RosterZone
            session={session ?? null}
            onUndo={(overallPick) => undoPick.mutate(overallPick)}
            isUndoing={undoPick.isPending}
          />
        </Card>
      </div>
    </div>
  );
}
