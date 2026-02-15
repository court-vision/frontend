"use client";

import { useMemo } from "react";
import { User, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { usePlayerStatsQuery, usePlayerPercentilesQuery } from "@/hooks/usePlayer";
import { StatCell, StatRow } from "../shared";
import { calculateRecentFormTrend } from "@/lib/chart-utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { StatWindow } from "@/types/terminal";

const WINDOW_LABELS: Record<StatWindow, string> = {
  season: "Season",
  l5: "L5",
  l10: "L10",
  l20: "L20",
};

export function PlayerFocusPanel() {
  const { focusedPlayerId, statWindow } = useTerminalStore();
  const { data: playerStats, isLoading, error } = usePlayerStatsQuery(
    focusedPlayerId,
    "nba",
    statWindow
  );
  const { data: percentiles } = usePlayerPercentilesQuery(focusedPlayerId);

  // Calculate trend from recent games (always uses full game logs)
  const trend = useMemo(() => {
    if (!playerStats?.game_logs || !playerStats?.avg_stats) return null;
    return calculateRecentFormTrend(
      playerStats.game_logs,
      playerStats.avg_stats.avg_fpts
    );
  }, [playerStats]);

  if (!focusedPlayerId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <User className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No player selected</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Search for a player using <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">/</kbd>
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <PlayerFocusSkeleton />;
  }

  if (error || !playerStats) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="text-sm text-destructive">Failed to load player data</p>
      </div>
    );
  }

  const { name, team, games_played, window_games, avg_stats } = playerStats;
  const isWindowed = statWindow !== "season";

  const trendDirection =
    trend?.trend === "hot" ? "up" : trend?.trend === "cold" ? "down" : "neutral";

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Player Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center shrink-0">
          <User className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{name}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span>{team}</span>
            <span className="text-border">·</span>
            <span>
              {isWindowed ? `${window_games} of ${games_played} GP` : `${games_played} GP`}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Stat - FPTS */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Fantasy Points
              {isWindowed && (
                <span className="ml-1 text-primary/70">
                  ({WINDOW_LABELS[statWindow]} avg)
                </span>
              )}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold text-primary tabular-nums">
                {avg_stats.avg_fpts.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">/game</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            {trend && (
              <>
                <TrendIndicator direction={trendDirection} />
                <span
                  className={cn(
                    "text-xs font-mono",
                    trendDirection === "up" && "text-green-500",
                    trendDirection === "down" && "text-red-500",
                    trendDirection === "neutral" && "text-muted-foreground"
                  )}
                >
                  {trend.diff > 0 ? "+" : ""}
                  {trend.diff.toFixed(1)} L5
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        <StatCell
          label="PTS"
          value={avg_stats.avg_points}
          size="sm"
          percentile={percentiles?.avg_points}
        />
        <StatCell
          label="REB"
          value={avg_stats.avg_rebounds}
          size="sm"
          percentile={percentiles?.avg_rebounds}
        />
        <StatCell
          label="AST"
          value={avg_stats.avg_assists}
          size="sm"
          percentile={percentiles?.avg_assists}
        />
        <StatCell
          label="STL"
          value={avg_stats.avg_steals}
          size="sm"
          percentile={percentiles?.avg_steals}
        />
        <StatCell
          label="BLK"
          value={avg_stats.avg_blocks}
          size="sm"
          percentile={percentiles?.avg_blocks}
        />
        <StatCell
          label="TOV"
          value={avg_stats.avg_turnovers}
          size="sm"
          percentile={percentiles?.avg_turnovers}
        />
      </div>

      {/* Shooting Splits */}
      <div className="mt-auto">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
          Shooting
        </span>
        <StatRow
          stats={[
            { label: "FG", value: `${avg_stats.avg_fg_pct}%`, decimals: 0 },
            { label: "3P", value: `${avg_stats.avg_fg3_pct}%`, decimals: 0 },
            { label: "FT", value: `${avg_stats.avg_ft_pct}%`, decimals: 0 },
          ]}
        />
        <StatRow
          stats={[
            { label: "MIN", value: avg_stats.avg_minutes, decimals: 1 },
          ]}
          className="mt-1"
        />
      </div>
    </div>
  );
}

function TrendIndicator({ direction }: { direction: "up" | "down" | "neutral" }) {
  const Icon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        "h-6 w-6 rounded-full flex items-center justify-center",
        direction === "up" && "bg-green-500/10 text-green-500",
        direction === "down" && "bg-red-500/10 text-red-500",
        direction === "neutral" && "bg-muted text-muted-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </div>
  );
}

function PlayerFocusSkeleton() {
  return (
    <div className="flex flex-col h-full p-3 gap-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-1" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-20 w-full rounded-lg" />
      <div className="grid grid-cols-3 gap-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    </div>
  );
}
