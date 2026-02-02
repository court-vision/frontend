"use client";

import { useMemo } from "react";
import { BarChart3, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { usePlayerStatsQuery } from "@/hooks/usePlayer";
import { Skeleton } from "@/components/ui/skeleton";
import type { GameLog } from "@/types/player";

interface StatBarProps {
  label: string;
  value: number;
  maxValue?: number;
  suffix?: string;
  precision?: number;
  colorClass?: string;
}

function StatBar({
  label,
  value,
  maxValue = 100,
  suffix = "",
  precision = 1,
  colorClass = "bg-primary",
}: StatBarProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium tabular-nums">
          {value.toFixed(precision)}
          {suffix}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", colorClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function LockedStat({ label }: { label: string }) {
  return (
    <div className="space-y-1 opacity-50">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <Lock className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full w-0 rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}

export function AdvancedStatsPanel() {
  const { focusedPlayerId } = useTerminalStore();
  const { data: playerStats, isLoading, error } = usePlayerStatsQuery(
    focusedPlayerId,
    "nba"
  );

  // Calculate derived stats from game logs
  const derivedStats = useMemo(() => {
    if (!playerStats?.game_logs || playerStats.game_logs.length === 0) {
      return null;
    }

    const logs = playerStats.game_logs;
    const totals = logs.reduce(
      (acc, log) => ({
        fgm: acc.fgm + log.fgm,
        fga: acc.fga + log.fga,
        fg3m: acc.fg3m + log.fg3m,
        fg3a: acc.fg3a + log.fg3a,
        ftm: acc.ftm + log.ftm,
        fta: acc.fta + log.fta,
        pts: acc.pts + log.pts,
      }),
      { fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, pts: 0 }
    );

    // True Shooting % = PTS / (2 * (FGA + 0.44 * FTA))
    const tsa = totals.fga + 0.44 * totals.fta;
    const ts_pct = tsa > 0 ? (totals.pts / (2 * tsa)) * 100 : 0;

    // Effective FG% = (FGM + 0.5 * 3PM) / FGA
    const efg_pct =
      totals.fga > 0
        ? ((totals.fgm + 0.5 * totals.fg3m) / totals.fga) * 100
        : 0;

    // 3-Point Rate = 3PA / FGA
    const three_rate = totals.fga > 0 ? (totals.fg3a / totals.fga) * 100 : 0;

    // Free Throw Rate = FTA / FGA
    const ft_rate = totals.fga > 0 ? (totals.fta / totals.fga) * 100 : 0;

    return {
      ts_pct,
      efg_pct,
      three_rate,
      ft_rate,
      fg_pct: totals.fga > 0 ? (totals.fgm / totals.fga) * 100 : 0,
      fg3_pct: totals.fg3a > 0 ? (totals.fg3m / totals.fg3a) * 100 : 0,
      ft_pct: totals.fta > 0 ? (totals.ftm / totals.fta) * 100 : 0,
    };
  }, [playerStats?.game_logs]);

  if (!focusedPlayerId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <BarChart3 className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No player selected</p>
      </div>
    );
  }

  if (isLoading) {
    return <AdvancedStatsSkeleton />;
  }

  if (error || !playerStats || !derivedStats) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="text-sm text-destructive">Failed to load advanced stats</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-3 gap-4 overflow-y-auto">
      {/* Shooting Efficiency */}
      <div>
        <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
          Shooting Efficiency
        </h4>
        <div className="space-y-3">
          <StatBar
            label="True Shooting %"
            value={derivedStats.ts_pct}
            maxValue={80}
            suffix="%"
            colorClass="bg-green-500"
          />
          <StatBar
            label="Effective FG%"
            value={derivedStats.efg_pct}
            maxValue={70}
            suffix="%"
            colorClass="bg-green-500"
          />
          <StatBar
            label="FG%"
            value={derivedStats.fg_pct}
            maxValue={60}
            suffix="%"
          />
          <StatBar
            label="3P%"
            value={derivedStats.fg3_pct}
            maxValue={50}
            suffix="%"
          />
          <StatBar
            label="FT%"
            value={derivedStats.ft_pct}
            maxValue={100}
            suffix="%"
          />
        </div>
      </div>

      {/* Shot Profile */}
      <div>
        <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
          Shot Profile
        </h4>
        <div className="space-y-3">
          <StatBar
            label="3-Point Rate"
            value={derivedStats.three_rate}
            maxValue={60}
            suffix="%"
            colorClass="bg-blue-500"
          />
          <StatBar
            label="Free Throw Rate"
            value={derivedStats.ft_rate}
            maxValue={50}
            suffix="%"
            colorClass="bg-amber-500"
          />
        </div>
      </div>

      {/* Advanced Stats (Locked - needs backend) */}
      <div>
        <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-1">
          Advanced
          <span className="text-[8px] bg-muted px-1 py-0.5 rounded">Soon</span>
        </h4>
        <div className="space-y-3">
          <LockedStat label="Usage Rate" />
          <LockedStat label="Net Rating" />
          <LockedStat label="PIE" />
          <LockedStat label="Assist %" />
          <LockedStat label="Rebound %" />
        </div>
      </div>
    </div>
  );
}

function AdvancedStatsSkeleton() {
  return (
    <div className="flex flex-col h-full p-3 gap-4">
      <div>
        <Skeleton className="h-3 w-24 mb-2" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-1.5 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
