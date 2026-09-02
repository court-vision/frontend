"use client";

import { Undo2, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { DraftPick, DraftSession } from "@/types/draft";

/**
 * The room's right rail: what the caller has taken, and where the draft is.
 *
 * WS4 scope is the shell — filled-vs-`roster_slots`, the category profile and
 * NBA-team stacking flags are workstream 5.
 */
interface RosterZoneProps {
  session: DraftSession | null;
  onUndo?: (overallPick: number) => void;
  isUndoing?: boolean;
}

function PickRow({
  pick,
  onUndo,
  isUndoing,
}: {
  pick: DraftPick;
  onUndo?: (overallPick: number) => void;
  isUndoing?: boolean;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 border-b border-border/20 px-2 py-1 font-mono text-[10px]",
        pick.by_me && "bg-primary/5"
      )}
    >
      <span className="w-6 shrink-0 text-right text-muted-foreground/70">{pick.overall_pick}</span>
      <span className={cn("truncate", pick.by_me ? "text-primary" : "text-foreground")}>
        {pick.player_name ?? `Player ${pick.player_id ?? "?"}`}
      </span>
      {pick.round !== null && pick.round !== undefined && (
        <span className="ml-auto shrink-0 text-muted-foreground/50">R{pick.round}</span>
      )}
      {onUndo && (
        <Button
          size="icon"
          variant="ghost"
          disabled={isUndoing}
          onClick={() => onUndo(pick.overall_pick)}
          title={`Undo pick ${pick.overall_pick}`}
          className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Undo2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export function RosterZone({ session, onUndo, isUndoing = false }: RosterZoneProps) {
  const picks = session?.picks ?? [];
  const mine = picks.filter((p) => p.by_me);
  const recent = [...picks].sort((a, b) => b.overall_pick - a.overall_pick).slice(0, 12);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/50 bg-muted/30 px-2 py-2">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <Users className="h-3 w-3" />
          My roster
          <span className="ml-auto font-mono normal-case tracking-normal">
            {mine.length}
            {session?.rounds ? ` / ${session.rounds}` : ""}
          </span>
        </div>
      </div>

      <div className="max-h-[45%] overflow-auto">
        {mine.length === 0 ? (
          <p className="px-2 py-3 text-[10px] text-muted-foreground">
            Nothing drafted yet. Use <span className="font-mono">Mine</span> on a board row.
          </p>
        ) : (
          mine.map((pick) => (
            <PickRow key={pick.overall_pick} pick={pick} onUndo={onUndo} isUndoing={isUndoing} />
          ))
        )}
      </div>

      <div className="shrink-0 border-y border-border/50 bg-muted/30 px-2 py-2">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Recent picks
          <span className="ml-auto font-mono normal-case tracking-normal">
            {session?.pick_count ?? 0}
            {session?.total_picks ? ` / ${session.total_picks}` : ""}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {recent.length === 0 ? (
          <p className="px-2 py-3 text-[10px] text-muted-foreground">
            The draft has not started.
          </p>
        ) : (
          recent.map((pick) => (
            <PickRow key={pick.overall_pick} pick={pick} onUndo={onUndo} isUndoing={isUndoing} />
          ))
        )}
      </div>
    </div>
  );
}
