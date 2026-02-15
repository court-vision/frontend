"use client";

import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { usePlayerStatsQuery } from "@/hooks/usePlayer";
import { Skeleton } from "@/components/ui/skeleton";

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

function EmptyStat({ label }: { label: string }) {
  return (
    <div className="space-y-1 opacity-40">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-muted-foreground">--</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full w-0 rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}

export function AdvancedStatsPanel() {
  const { focusedPlayerId, statWindow } = useTerminalStore();
  const { data: playerStats, isLoading, error } = usePlayerStatsQuery(
    focusedPlayerId,
    "nba",
    statWindow
  );

  const isWindowed = statWindow !== "season";

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

  if (error || !playerStats) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="text-sm text-destructive">Failed to load advanced stats</p>
      </div>
    );
  }

  const { avg_stats, advanced_stats } = playerStats;

  return (
    <div className="flex flex-col h-full p-3 gap-4 overflow-y-auto">
      {/* Shooting Efficiency - computed from windowed game logs */}
      <div>
        <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
          Shooting Efficiency
        </h4>
        <div className="space-y-3">
          <StatBar
            label="True Shooting %"
            value={avg_stats.avg_ts_pct}
            maxValue={80}
            suffix="%"
            colorClass="bg-green-500"
          />
          <StatBar
            label="Effective FG%"
            value={avg_stats.avg_efg_pct}
            maxValue={70}
            suffix="%"
            colorClass="bg-green-500"
          />
          <StatBar
            label="FG%"
            value={avg_stats.avg_fg_pct}
            maxValue={60}
            suffix="%"
          />
          <StatBar
            label="3P%"
            value={avg_stats.avg_fg3_pct}
            maxValue={50}
            suffix="%"
          />
          <StatBar
            label="FT%"
            value={avg_stats.avg_ft_pct}
            maxValue={100}
            suffix="%"
          />
        </div>
      </div>

      {/* Shot Profile - computed from windowed game logs */}
      <div>
        <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
          Shot Profile
        </h4>
        <div className="space-y-3">
          <StatBar
            label="3-Point Rate"
            value={avg_stats.avg_three_rate}
            maxValue={60}
            suffix="%"
            colorClass="bg-blue-500"
          />
          <StatBar
            label="Free Throw Rate"
            value={avg_stats.avg_ft_rate}
            maxValue={50}
            suffix="%"
            colorClass="bg-amber-500"
          />
        </div>
      </div>

      {/* Advanced Stats - always season-level from pipeline */}
      <div>
        <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-1">
          Advanced
          {isWindowed && (
            <span className="text-[8px] bg-muted px-1 py-0.5 rounded">Season</span>
          )}
        </h4>
        <div className="space-y-3">
          {advanced_stats ? (
            <>
              {advanced_stats.usg_pct != null ? (
                <StatBar
                  label="Usage Rate"
                  value={advanced_stats.usg_pct}
                  maxValue={40}
                  suffix="%"
                  colorClass="bg-violet-500"
                />
              ) : (
                <EmptyStat label="Usage Rate" />
              )}
              {advanced_stats.net_rating != null ? (
                <StatBar
                  label="Net Rating"
                  value={advanced_stats.net_rating}
                  maxValue={20}
                  precision={1}
                  colorClass={advanced_stats.net_rating >= 0 ? "bg-green-500" : "bg-red-500"}
                />
              ) : (
                <EmptyStat label="Net Rating" />
              )}
              {advanced_stats.pie != null ? (
                <StatBar
                  label="PIE"
                  value={advanced_stats.pie}
                  maxValue={25}
                  suffix="%"
                  precision={1}
                  colorClass="bg-orange-500"
                />
              ) : (
                <EmptyStat label="PIE" />
              )}
              {advanced_stats.ast_pct != null ? (
                <StatBar
                  label="Assist %"
                  value={advanced_stats.ast_pct}
                  maxValue={50}
                  suffix="%"
                  colorClass="bg-cyan-500"
                />
              ) : (
                <EmptyStat label="Assist %" />
              )}
              {advanced_stats.reb_pct != null ? (
                <StatBar
                  label="Rebound %"
                  value={advanced_stats.reb_pct}
                  maxValue={25}
                  suffix="%"
                  colorClass="bg-teal-500"
                />
              ) : (
                <EmptyStat label="Rebound %" />
              )}
            </>
          ) : (
            <>
              <EmptyStat label="Usage Rate" />
              <EmptyStat label="Net Rating" />
              <EmptyStat label="PIE" />
              <EmptyStat label="Assist %" />
              <EmptyStat label="Rebound %" />
            </>
          )}
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
