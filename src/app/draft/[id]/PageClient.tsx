"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { stepHighlight, targetRow, visibleRows } from "@/lib/draft-board";
import { keeperStatuses, lastPick, samePlayer, type KeeperStatus } from "@/lib/draft-roster";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-error";
import { DraftBoardTable } from "@/components/draft/DraftBoardTable";
import { DraftSyncChip } from "@/components/draft/DraftSyncChip";
import { KeeperEditor } from "@/components/draft/KeeperEditor";
import { SlotEditor } from "@/components/draft/SlotEditor";
import { RecommendationStrip } from "@/components/draft/RecommendationStrip";
import { RosterZone } from "@/components/draft/RosterZone";
import { useDraftRoomHotkeys } from "@/hooks/useDraftRoomHotkeys";
import { useEspnDraftSync } from "@/hooks/useEspnDraftSync";
import {
  useDraftBoardQuery,
  useDraftPickMutation,
  useDraftSessionQuery,
  useUndoDraftPickMutation,
  useUpdateDraftSessionMutation,
} from "@/hooks/useDrafts";
import { useTeamsQuery } from "@/hooks/useTeams";
import { useDraftRoomStore } from "@/stores/useDraftRoomStore";
import type { DraftBoardRow, DraftKeeper } from "@/types/draft";

/**
 * The draft room: recommendation strip on top, board in the centre, roster on
 * the right (design doc §3.1).
 *
 * The keyboard is the primary input on draft day. `/` lands in the pick
 * input; typing filters the board; ↵ marks the top match drafted by someone
 * else and ⇧↵ drafted by me; `j`/`k`, `o`/`m` do the same from anywhere on
 * the page; ⌘Z undoes the last pick. Keepers are pre-designated in the
 * editor and recorded as picks from the roster zone.
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
  const updateSession = useUpdateDraftSessionMutation(sessionId);

  // Live ESPN sync (via the Draft Tap extension). The ESPN league id a frame
  // belongs to is matched against this session's team; a mock or unsynced
  // session has none and accepts any room.
  const { data: teams } = useTeamsQuery();
  const expectedLeagueId = useMemo(() => {
    if (session?.team_id == null) return null;
    const team = teams?.find((t) => t.team_id === session.team_id);
    return team?.league_info.provider === "espn" ? team.league_info.league_id : null;
  }, [teams, session?.team_id]);
  const sync = useEspnDraftSync({
    sessionId,
    session,
    board,
    expectedLeagueId,
    // Wait for the teams list before enabling a team session, or the first
    // frames would race an unknown expected league and briefly mis-flag a
    // mismatch. A mock session (no team) needs no teams.
    enabled: Boolean(session && session.status === "active" && (session.team_id == null || teams)),
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const [keepersOpen, setKeepersOpen] = useState(false);
  const [slotOpen, setSlotOpen] = useState(false);
  const [recordingKeepers, setRecordingKeepers] = useState(false);

  const { sortKey, sortDirection, positionFilter, hideCapped, search, highlightId, setSearch, setHighlight } =
    useDraftRoomStore();
  const rows = useMemo(() => board?.rows ?? [], [board]);
  const visible = useMemo(
    () => visibleRows(rows, { sortKey, sortDirection, positionFilter, hideCapped, search }),
    [rows, sortKey, sortDirection, positionFilter, hideCapped, search]
  );

  const keepers = useMemo(
    () => keeperStatuses(session?.keepers ?? [], session?.picks ?? []),
    [session]
  );
  const pendingKeepers = useMemo(
    () => keepers.filter((k) => !k.recorded && k.blocker === null),
    [keepers]
  );
  const pendingKeeperIds = useMemo(
    () =>
      new Set(
        keepers
          .filter((k) => !k.recorded && k.keeper.player_id != null)
          .map((k) => k.keeper.player_id as number)
      ),
    [keepers]
  );

  const handlePick = useCallback(
    (row: DraftBoardRow, byMe: boolean) => {
      // A pending keeper is not an ordinary pick. Marked as one it would be
      // recorded at the draft front instead of the pick its round costs, and
      // `keeperStatuses` would then count it as recorded — retiring the keeper
      // flow and, if marked `out`, handing your own keeper to another team.
      const identity = {
        player_id: row.player_id,
        espn_player_id: row.espn_id,
        player_name: row.name,
      };
      if (pendingKeepers.some((k) => samePlayer(k.keeper, identity))) {
        toast.error(`${row.name} is one of your keepers — record it from the roster zone`);
        return;
      }
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
    [addPick, pendingKeepers]
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

  // ---- keyboard: highlight, mark, undo ----

  // What a keystroke would act on right now: the highlight while it is
  // visible, else the first row — which is what the table renders as active.
  const activeId = useMemo(
    () => targetRow(visible, highlightId)?.player_id ?? null,
    [visible, highlightId]
  );

  const moveHighlight = useCallback(
    (delta: 1 | -1) => {
      // Stepping from `activeId`, not the raw highlight: after a search clears
      // the highlight the first row is already shown active, and stepping from
      // null would leave it there (or jump to the last row on `k`).
      setHighlight(stepHighlight(visible.map((row) => row.player_id), activeId, delta));
    },
    [visible, activeId, setHighlight]
  );

  const markHighlighted = useCallback(
    (byMe: boolean) => {
      // The row buttons disable while a pick is in flight; the keys have to
      // agree, or two quick presses race two POSTs that both take "the lowest
      // unused pick" and can land their players on each other's numbers.
      if (addPick.isPending) return;
      const row = targetRow(visible, highlightId);
      if (!row) return;
      if (byMe && row.cap_blocked) {
        toast.error(`${row.name} would break your ${row.primary_position ?? "position"} cap`);
        return;
      }
      handlePick(row, byMe);
      // Clear for the next name; the input keeps focus so typing continues.
      setSearch("");
      setHighlight(null);
    },
    [visible, highlightId, handlePick, setSearch, setHighlight, addPick.isPending]
  );

  const undoLast = useCallback(() => {
    const last = lastPick(session?.picks ?? []);
    if (!last) {
      toast.message("Nothing to undo");
      return;
    }
    undoPick.mutate(last.overall_pick);
  }, [session, undoPick]);

  const focusInput = useCallback(() => inputRef.current?.focus(), []);

  // The room store is a singleton, so a highlight survives client-side
  // navigation between rooms. Clear it on arrival: the first `o`/`m` in a new
  // room must not act on a player highlighted in the previous one.
  useEffect(() => {
    setHighlight(null);
  }, [sessionId, setHighlight]);

  useDraftRoomHotkeys({
    enabled: Boolean(session && board && !keepersOpen),
    focusInput,
    moveHighlight,
    markHighlighted,
    undoLast,
  });

  // ---- keepers ----

  const saveKeepers = useCallback(
    (list: DraftKeeper[]) => {
      updateSession.mutate(
        { keepers: list },
        {
          onSuccess: () => {
            setKeepersOpen(false);
            toast.success(`${list.length} keeper${list.length === 1 ? "" : "s"} saved`);
          },
          onError: () => toast.error("Keepers could not be saved"),
        }
      );
    },
    [updateSession]
  );

  const saveSlot = useCallback(
    (slot: number | null) => {
      updateSession.mutate(
        { my_slot: slot },
        {
          onSuccess: () => {
            setSlotOpen(false);
            toast.success(slot === null ? "Slot cleared" : `You are drafting from slot ${slot}`);
          },
          // The backend refuses a slot outside the pick order, and one that
          // would strand or collide a recorded keeper — say which.
          onError: (error) =>
            toast.error(error instanceof Error ? error.message : "That slot could not be set"),
        }
      );
    },
    [updateSession]
  );

  const recordKeepers = useCallback(
    async (pending: KeeperStatus[]) => {
      setRecordingKeepers(true);
      let recorded = 0;
      try {
        for (const { keeper } of pending) {
          if (keeper.overall_pick == null) continue;
          await addPick.mutateAsync({
            player_id: keeper.player_id ?? null,
            espn_player_id: keeper.espn_player_id ?? null,
            player_name: keeper.name ?? null,
            by_me: true,
            source: "keeper",
            overall_pick: keeper.overall_pick,
            bid: null,
          });
          recorded += 1;
        }
        toast.success(`${recorded} keeper${recorded === 1 ? "" : "s"} recorded`);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "A keeper could not be recorded — check its round and your slot"
        );
      } finally {
        setRecordingKeepers(false);
      }
    },
    [addPick]
  );

  const onTheClock =
    session?.picks_until_my_turn === 0 && session.status === "active";

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
              {" · "}
              <button
                onClick={() => setSlotOpen(true)}
                title="Set or correct which seat is yours"
                className={cn(
                  "underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground",
                  session.my_slot === null && "text-amber-500"
                )}
              >
                {session.my_slot ? `slot ${session.my_slot}` : "no slot set"}
              </button>
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
      <div className="flex items-center gap-2">
        <DraftSyncChip sync={sync} />
        <Link href="/draft">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        </Link>
      </div>
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

      {sync.state.reset && (
        <Card variant="panel" className="border-status-loss/60 bg-status-loss/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              <span className="font-medium">ESPN reset this draft.</span>{" "}
              <span className="text-muted-foreground">
                Sync is paused so nothing is deleted automatically — undo picks by hand or start a new
                session, then resume.
              </span>
            </p>
            <Button variant="outline" size="sm" className="shrink-0 text-xs" onClick={sync.resume}>
              Resume sync
            </Button>
          </div>
        </Card>
      )}

      {/* Recommendation strip */}
      <Card
        variant="panel"
        className={cn("overflow-hidden transition-colors", onTheClock && "border-primary/60")}
      >
        <div
          className={cn(
            "flex items-center gap-2 border-b border-border/50 bg-muted/30 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground",
            onTheClock && "bg-primary/10 text-primary"
          )}
        >
          {onTheClock ? `On the clock — pick ${session?.next_overall_pick}` : "Best available"}
          {session?.my_slot === null && (
            <button
              onClick={() => setSlotOpen(true)}
              className="normal-case tracking-normal text-amber-500 underline decoration-dotted underline-offset-2 hover:text-amber-400"
            >
              set your slot to see whose turn it is
            </button>
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
      <div className={cn("grid gap-3", "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]")}>
        <Card variant="panel" className="h-[600px] overflow-hidden">
          {boardError ? (
            <QueryErrorState error={boardError} fallback="The board could not be loaded." />
          ) : (
            <DraftBoardTable
              rows={rows}
              meta={board?.meta ?? null}
              message={board?.message ?? ""}
              isLoading={boardLoading}
              onPick={handlePick}
              isPicking={addPick.isPending}
              onMark={markHighlighted}
              onMove={moveHighlight}
              onUndoLast={undoLast}
              inputRef={inputRef}
              keeperIds={pendingKeeperIds}
            />
          )}
        </Card>

        <Card variant="panel" className="h-[600px] overflow-hidden">
          <RosterZone
            session={session ?? null}
            board={board ?? null}
            onUndo={(overallPick) => undoPick.mutate(overallPick)}
            onUndoLast={undoLast}
            isUndoing={undoPick.isPending}
            onEditKeepers={() => setKeepersOpen(true)}
            onRecordKeepers={recordKeepers}
            isRecordingKeepers={recordingKeepers || addPick.isPending}
          />
        </Card>
      </div>

      {session && (
        <>
          <KeeperEditor
            open={keepersOpen}
            onOpenChange={setKeepersOpen}
            session={session}
            rows={rows}
            onSave={saveKeepers}
            isSaving={updateSession.isPending}
            onEditSlot={() => {
              // One dialog at a time: hand off rather than stack.
              setKeepersOpen(false);
              setSlotOpen(true);
            }}
          />
          <SlotEditor
            open={slotOpen}
            onOpenChange={setSlotOpen}
            session={session}
            onSave={saveSlot}
            isSaving={updateSession.isPending}
          />
        </>
      )}
    </div>
  );
}
