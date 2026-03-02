"use client";

import { useMemo } from "react";
import { User, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { usePlayerStatsQuery, usePlayerPercentilesQuery } from "@/hooks/usePlayer";
import { usePlayerStatusQuery } from "@/hooks/usePlayerStatus";
import { usePlayerOwnershipQuery } from "@/hooks/usePlayerOwnership";
import { useTeamScheduleQuery } from "@/hooks/useTeamSchedule";
import { useRankingsQuery } from "@/hooks/useRankings";
import { StatCell } from "../shared";
import { calculateRecentFormTrend } from "@/lib/chart-utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { StatWindow } from "@/types/terminal";

const WINDOW_LABELS: Record<StatWindow, string> = {
  season: "Season",
  l5: "L5",
  l10: "L10",
  l20: "L20",
};

const INJURY_BADGE_STYLES: Record<string, string> = {
  Out: "bg-red-500/20 text-red-400 border-red-500/30",
  Doubtful: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Questionable: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Probable: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const INJURY_ABBREV: Record<string, string> = {
  Out: "OUT",
  Doubtful: "D",
  Questionable: "Q",
  Probable: "P",
};

function DefRatingDot({ rating }: { rating: number }) {
  const color =
    rating > 115
      ? "bg-green-500"   // weak defense = easy matchup
      : rating >= 110
      ? "bg-amber-500"
      : "bg-red-500";    // strong defense = hard matchup
  return <span className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", color)} />;
}

export function PlayerFocusPanel() {
  const { focusedPlayerId, statWindow } = useTerminalStore();
  const { data: playerStats, isLoading, error } = usePlayerStatsQuery(
    focusedPlayerId,
    "nba",
    statWindow
  );
  const { data: percentiles } = usePlayerPercentilesQuery(focusedPlayerId);
  const { data: statusData } = usePlayerStatusQuery(focusedPlayerId);
  const { data: ownershipData } = usePlayerOwnershipQuery(focusedPlayerId);
  const { data: rankings } = useRankingsQuery();

  // Look up rank and team from rankings cache
  const rankingEntry = useMemo(() => {
    if (!rankings || !focusedPlayerId) return null;
    return rankings.find((r) => r.id === focusedPlayerId) ?? null;
  }, [rankings, focusedPlayerId]);

  // Derive team: prefer stats (most recent), fall back to rankings
  const team = playerStats?.team ?? rankingEntry?.team ?? null;

  // Team schedule for next game (upcoming only, limit 3)
  const { data: scheduleData } = useTeamScheduleQuery(team, true, 3);
  const nextGame = scheduleData?.schedule?.[0] ?? null;

  // Calculate trend from recent games
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
          Search for a player using{" "}
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">/</kbd>
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

  const { name, games_played, window_games, avg_stats } = playerStats;
  const isWindowed = statWindow !== "season";
  const trendDirection =
    trend?.trend === "hot" ? "up" : trend?.trend === "cold" ? "down" : "neutral";

  const injuryStatus = statusData?.status;
  const showInjuryBadge =
    injuryStatus && injuryStatus !== "Available" && injuryStatus in INJURY_ABBREV;

  const rank = rankingEntry?.rank ?? null;
  const ownership = ownershipData?.current_ownership ?? null;

  return (
    <div className="flex flex-col h-full p-2 gap-2 overflow-y-auto">
      {/* Player Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-semibold text-sm truncate leading-tight">{name}</h3>
            {showInjuryBadge && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold border shrink-0",
                  INJURY_BADGE_STYLES[injuryStatus!]
                )}
              >
                <AlertTriangle className="h-2 w-2" />
                {INJURY_ABBREV[injuryStatus!]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono mt-0.5 flex-wrap">
            <span>{team ?? "—"}</span>
            {rank !== null && (
              <>
                <span className="text-border">·</span>
                <span className="text-primary/80">#{rank}</span>
              </>
            )}
            {ownership !== null && (
              <>
                <span className="text-border">·</span>
                <span>{ownership.toFixed(1)}%</span>
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] text-muted-foreground">
            {isWindowed ? `${window_games}/${games_played}` : `${games_played}`} GP
          </div>
        </div>
      </div>

      {/* Primary Stat - FPTS */}
      <div className="bg-primary/5 border border-primary/20 rounded-md px-2.5 py-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Fantasy Pts{isWindowed && <span className="ml-1 text-primary/70">({WINDOW_LABELS[statWindow]})</span>}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-mono font-bold text-primary tabular-nums">
                {avg_stats.avg_fpts.toFixed(1)}
              </span>
            </div>
          </div>
          {trend && (
            <div className="flex flex-col items-end gap-0.5">
              <TrendIndicator direction={trendDirection} />
              <span
                className={cn(
                  "text-[10px] font-mono",
                  trendDirection === "up" && "text-green-500",
                  trendDirection === "down" && "text-red-500",
                  trendDirection === "neutral" && "text-muted-foreground"
                )}
              >
                {trend.diff > 0 ? "+" : ""}
                {trend.diff.toFixed(1)} L5
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Next Game Row */}
      {nextGame && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted/40 border border-border/40 text-[10px] font-mono">
          <span className="text-muted-foreground shrink-0">NEXT</span>
          <span className="text-foreground/80">
            {nextGame.home ? "vs" : "@"} {nextGame.opponent}
          </span>
          <span className="text-muted-foreground">{formatGameDate(nextGame.date)}</span>
          {nextGame.back_to_back && (
            <span className="px-1 py-0.5 rounded text-[8px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold shrink-0">
              B2B
            </span>
          )}
          {nextGame.opponent_def_rating !== null && (
            <span className="ml-auto flex items-center gap-1 text-muted-foreground shrink-0">
              <DefRatingDot rating={nextGame.opponent_def_rating} />
              {nextGame.opponent_def_rating.toFixed(1)}
            </span>
          )}
        </div>
      )}

      {/* Stats Grid 2×4 */}
      <div className="grid grid-cols-4 gap-1.5">
        <StatCell label="PTS" value={avg_stats.avg_points} size="sm" percentile={percentiles?.avg_points} />
        <StatCell label="REB" value={avg_stats.avg_rebounds} size="sm" percentile={percentiles?.avg_rebounds} />
        <StatCell label="AST" value={avg_stats.avg_assists} size="sm" percentile={percentiles?.avg_assists} />
        <StatCell label="3PM" value={avg_stats.avg_fg3m} size="sm" />
        <StatCell label="STL" value={avg_stats.avg_steals} size="sm" percentile={percentiles?.avg_steals} />
        <StatCell label="BLK" value={avg_stats.avg_blocks} size="sm" percentile={percentiles?.avg_blocks} />
        <StatCell label="TOV" value={avg_stats.avg_turnovers} size="sm" percentile={percentiles?.avg_turnovers} />
        <StatCell label="MIN" value={avg_stats.avg_minutes} size="sm" />
      </div>

      {/* Shooting Volume */}
      <div className="flex items-center justify-between px-1 py-1 border-t border-border/30 text-[10px] font-mono">
        <span className="text-muted-foreground">FG</span>
        <span className="tabular-nums">{avg_stats.avg_fgm.toFixed(1)}/{avg_stats.avg_fga.toFixed(1)}</span>
        <span className="text-border mx-1">·</span>
        <span className="text-muted-foreground">3P</span>
        <span className="tabular-nums">{avg_stats.avg_fg3m.toFixed(1)}/{avg_stats.avg_fg3a.toFixed(1)}</span>
        <span className="text-border mx-1">·</span>
        <span className="text-muted-foreground">FT</span>
        <span className="tabular-nums">{avg_stats.avg_ftm.toFixed(1)}/{avg_stats.avg_fta.toFixed(1)}</span>
      </div>
    </div>
  );
}

function formatGameDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
}

function TrendIndicator({ direction }: { direction: "up" | "down" | "neutral" }) {
  const Icon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  return (
    <div
      className={cn(
        "h-5 w-5 rounded-full flex items-center justify-center",
        direction === "up" && "bg-green-500/10 text-green-500",
        direction === "down" && "bg-red-500/10 text-red-500",
        direction === "neutral" && "bg-muted text-muted-foreground"
      )}
    >
      <Icon className="h-3 w-3" />
    </div>
  );
}

function PlayerFocusSkeleton() {
  return (
    <div className="flex flex-col h-full p-2 gap-2">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-3 w-12" />
      </div>
      <Skeleton className="h-16 w-full rounded-md" />
      <Skeleton className="h-8 w-full rounded-md" />
      <div className="grid grid-cols-4 gap-1.5">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
      <Skeleton className="h-6 w-full" />
    </div>
  );
}
