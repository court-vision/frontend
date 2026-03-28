"use client";

import { useMemo } from "react";
import { Shield, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useTeamScheduleQuery } from "@/hooks/useTeamSchedule";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScheduleGame } from "@/types/games";

function DifficultyBadge({ rank, total }: { rank: number; total: number }) {
  const pct = rank / total;
  const color =
    pct <= 0.33
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : pct <= 0.66
      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
      : "bg-green-500/20 text-green-400 border-green-500/30";
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 font-mono", color)}>
      #{rank}
    </span>
  );
}

export function NBATeamMatchupDifficultyPanel() {
  const { focusedNBATeamId } = useTerminalStore();
  // Use same params as NBATeamSchedulePanel so TanStack Query deduplicates the request
  const { data: scheduleData, isLoading, error } = useTeamScheduleQuery(focusedNBATeamId, false, 100);

  const sortedUpcoming = useMemo<Array<ScheduleGame & { diffRank: number }>>(() => {
    if (!scheduleData?.schedule) return [];
    const upcoming = scheduleData.schedule.filter((g) => g.status === "scheduled");
    const sorted = [...upcoming].sort((a, b) => {
      if (a.opponent_def_rating === null && b.opponent_def_rating === null) return 0;
      if (a.opponent_def_rating === null) return 1;
      if (b.opponent_def_rating === null) return -1;
      return b.opponent_def_rating - a.opponent_def_rating;
    });
    return sorted.map((g, i) => ({ ...g, diffRank: i + 1 }));
  }, [scheduleData]);

  if (!focusedNBATeamId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Shield className="h-6 w-6 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No team selected</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
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

  if (sortedUpcoming.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Shield className="h-6 w-6 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No upcoming games</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {sortedUpcoming.map((game, i) => {
          const date = new Date(game.date + "T00:00:00");
          const dateLabel = date.toLocaleDateString("en-US", {
            weekday: "short",
            month: "numeric",
            day: "numeric",
          });

          return (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 border-b border-border/30 text-[10px] font-mono"
            >
              <DifficultyBadge rank={game.diffRank} total={sortedUpcoming.length} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground shrink-0">{game.home ? "vs" : "@"}</span>
                  <span className="font-medium text-foreground/90 truncate">{game.opponent}</span>
                  {game.back_to_back && (
                    <span className="px-0.5 rounded text-[8px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold shrink-0">
                      B2B
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground/60 text-[9px]">{dateLabel}</div>
              </div>
              <div className="shrink-0 text-right">
                {game.opponent_def_rating !== null ? (
                  <div
                    className={cn(
                      "font-bold",
                      game.opponent_def_rating > 115
                        ? "text-green-400"
                        : game.opponent_def_rating >= 110
                        ? "text-amber-400"
                        : "text-red-400"
                    )}
                  >
                    {game.opponent_def_rating.toFixed(1)}
                  </div>
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
                <div className="text-[9px] text-muted-foreground/50">DRtg</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-3 py-1 border-t text-[9px] text-muted-foreground/60 font-mono shrink-0">
        Sorted hardest → easiest · {sortedUpcoming.length} upcoming
      </div>
    </div>
  );
}
