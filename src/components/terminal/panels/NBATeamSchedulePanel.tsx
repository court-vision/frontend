"use client";

import { useMemo, useRef, useEffect } from "react";
import { CalendarDays, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useTeamScheduleQuery } from "@/hooks/useTeamSchedule";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScheduleGame } from "@/types/games";

function DefRatingDot({ rating }: { rating: number | null }) {
  if (rating === null)
    return <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/30 shrink-0" />;
  const color =
    rating > 115 ? "bg-green-500" : rating >= 110 ? "bg-amber-500" : "bg-red-500";
  return (
    <span
      className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", color)}
      title={`Def Rtg: ${rating.toFixed(1)}`}
    />
  );
}

function GameRow({
  game,
  isNext,
  rowRef,
}: {
  game: ScheduleGame;
  isNext: boolean;
  rowRef?: React.Ref<HTMLDivElement>;
}) {
  const isPast = game.status === "final";
  const isLive = game.status === "in_progress";
  const date = new Date(game.date + "T00:00:00");
  const dateLabel = date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
  const dayLabel = date.toLocaleDateString("en-US", { weekday: "short" });

  return (
    <div
      ref={rowRef}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 border-b border-border/30 text-[10px] font-mono",
        isPast && "opacity-40",
        isLive && "bg-primary/5",
        isNext && "bg-primary/10 border-l-2 border-l-primary"
      )}
    >
      <div className="shrink-0 w-14 text-muted-foreground">
        <span className="text-foreground/70">{dayLabel}</span>{" "}
        <span>{dateLabel}</span>
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-1">
        <span className="text-muted-foreground shrink-0">{game.home ? "vs" : "@"}</span>
        <span className={cn("font-medium truncate", isNext ? "text-foreground" : "text-foreground/80")}>
          {game.opponent}
        </span>
        {game.back_to_back && (
          <span className="px-0.5 rounded text-[8px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold shrink-0">
            B2B
          </span>
        )}
      </div>
      <div className="shrink-0 text-right w-14">
        {isPast && game.team_score !== null && game.opponent_score !== null ? (
          <span className={cn(game.team_score > game.opponent_score ? "text-green-500" : "text-red-400")}>
            {game.team_score > game.opponent_score ? "W" : "L"} {game.team_score}-{game.opponent_score}
          </span>
        ) : isLive ? (
          <span className="text-primary animate-pulse">LIVE</span>
        ) : isNext ? (
          <span className="text-primary/60">NEXT</span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1 w-10 justify-end">
        <DefRatingDot rating={game.opponent_def_rating} />
        {game.opponent_def_rating !== null && (
          <span className="text-muted-foreground/60">{game.opponent_def_rating.toFixed(0)}</span>
        )}
      </div>
    </div>
  );
}

export function NBATeamSchedulePanel() {
  const { focusedNBATeamId } = useTerminalStore();
  const { data: scheduleData, isLoading, error } = useTeamScheduleQuery(focusedNBATeamId, false, 82);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const firstUpcomingRef = useRef<HTMLDivElement>(null);

  const firstUpcomingIndex = useMemo(() => {
    if (!scheduleData?.schedule) return -1;
    return scheduleData.schedule.findIndex((g) => g.status === "scheduled");
  }, [scheduleData]);

  useEffect(() => {
    if (firstUpcomingRef.current) {
      firstUpcomingRef.current.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, [scheduleData, focusedNBATeamId]);

  if (!focusedNBATeamId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <CalendarDays className="h-6 w-6 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No team selected</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
      </div>
    );
  }

  if (error || !scheduleData) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertCircle className="h-5 w-5 text-destructive/50 mb-2" />
        <p className="text-xs text-destructive">Failed to load schedule</p>
      </div>
    );
  }

  const games = scheduleData.schedule;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1 border-b border-border/50 text-[9px] uppercase tracking-wider text-muted-foreground/60 font-mono shrink-0">
        <div className="w-14">Date</div>
        <div className="flex-1">Opponent</div>
        <div className="w-14 text-right">Score</div>
        <div className="w-10 text-right">DRtg</div>
      </div>
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {games.map((game, i) => (
          <GameRow
            key={i}
            game={game}
            isNext={i === firstUpcomingIndex}
            rowRef={i === firstUpcomingIndex ? firstUpcomingRef : undefined}
          />
        ))}
        {games.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
            No games found
          </div>
        )}
      </div>
      <div className="px-3 py-1 border-t text-[9px] text-muted-foreground font-mono shrink-0 flex items-center gap-2">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" /> &lt;110
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" /> 110–115
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" /> &gt;115
        </span>
        <span className="ml-auto text-muted-foreground/50">Def Rtg</span>
      </div>
    </div>
  );
}
