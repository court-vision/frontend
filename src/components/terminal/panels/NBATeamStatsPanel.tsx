"use client";

import { BarChart3, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useNBATeamStatsQuery } from "@/hooks/useNBATeam";
import { Skeleton } from "@/components/ui/skeleton";

function RatingBlock({
  label,
  value,
  mode = "net",
}: {
  label: string;
  value: number | null;
  mode?: "net" | "off" | "def";
}) {
  const color =
    value === null
      ? "text-muted-foreground/40"
      : mode === "off"
      ? value >= 115 ? "text-green-400" : value >= 110 ? "text-amber-400" : "text-red-400"
      : mode === "def"
      ? value <= 110 ? "text-green-400" : value <= 115 ? "text-amber-400" : "text-red-400"
      : value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-muted-foreground";

  return (
    <div className="flex flex-col items-center">
      <span className={cn("text-xl font-bold tabular-nums leading-none", color)}>
        {value !== null ? (value > 0 && mode === "net" ? `+${value.toFixed(1)}` : value.toFixed(1)) : "—"}
      </span>
      <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}

function StatRow({ label, value, pct = false }: { label: string; value: number | null; pct?: boolean }) {
  const display =
    value === null
      ? "—"
      : pct
      ? `${(value * 100).toFixed(1)}%`
      : value.toFixed(1);
  return (
    <div className="flex items-center justify-between px-3 py-1 border-b border-border/20 text-[10px] font-mono">
      <span className="text-muted-foreground/70">{label}</span>
      <span className="text-foreground tabular-nums">{display}</span>
    </div>
  );
}

export function NBATeamStatsPanel() {
  const { focusedNBATeamId } = useTerminalStore();
  const { data: stats, isLoading, error } = useNBATeamStatsQuery(focusedNBATeamId);

  if (!focusedNBATeamId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <BarChart3 className="h-6 w-6 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No team selected</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertCircle className="h-5 w-5 text-destructive/50 mb-2" />
        <p className="text-xs text-destructive">Failed to load team stats</p>
      </div>
    );
  }

  const wPct = stats.w_pct !== null ? `${(stats.w_pct * 100).toFixed(1)}%` : "—";

  return (
    <div className="flex flex-col h-full overflow-y-auto font-mono">
      {/* Record */}
      <div className="px-3 py-2 border-b border-border/50 shrink-0">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground/60 uppercase tracking-wider">Record</span>
          <span className="text-foreground font-bold">
            {stats.w ?? "—"}–{stats.l ?? "—"}
            <span className="text-muted-foreground/50 ml-1">({wPct})</span>
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] mt-0.5">
          <span className="text-muted-foreground/60 uppercase tracking-wider">Pace</span>
          <span className="text-foreground">{stats.pace !== null ? stats.pace.toFixed(1) : "—"}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] mt-0.5">
          <span className="text-muted-foreground/60 uppercase tracking-wider">Season</span>
          <span className="text-muted-foreground">{stats.season}</span>
        </div>
      </div>

      {/* Efficiency ratings */}
      <div className="flex items-center justify-around px-3 py-3 border-b border-border/50 shrink-0">
        <RatingBlock label="OFF RTG" value={stats.off_rating} mode="off" />
        <div className="w-px h-8 bg-border/30" />
        <RatingBlock label="NET RTG" value={stats.net_rating} mode="net" />
        <div className="w-px h-8 bg-border/30" />
        <RatingBlock label="DEF RTG" value={stats.def_rating} mode="def" />
      </div>

      {/* Per-game stats */}
      <div className="shrink-0">
        <div className="px-3 py-1 text-[9px] text-muted-foreground/40 uppercase tracking-wider border-b border-border/30">
          Per Game
        </div>
        <StatRow label="PTS" value={stats.pts} />
        <StatRow label="REB" value={stats.reb} />
        <StatRow label="AST" value={stats.ast} />
        <StatRow label="STL" value={stats.stl} />
        <StatRow label="BLK" value={stats.blk} />
        <StatRow label="TOV" value={stats.tov} />
      </div>

      {/* Shooting */}
      <div className="shrink-0">
        <div className="px-3 py-1 text-[9px] text-muted-foreground/40 uppercase tracking-wider border-b border-border/30">
          Shooting
        </div>
        <StatRow label="FG%" value={stats.fg_pct} pct />
        <StatRow label="3P%" value={stats.fg3_pct} pct />
        <StatRow label="FT%" value={stats.ft_pct} pct />
        <StatRow label="TS%" value={stats.ts_pct} pct />
        <StatRow label="EFG%" value={stats.efg_pct} pct />
      </div>
    </div>
  );
}
