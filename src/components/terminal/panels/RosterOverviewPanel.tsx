"use client";

import { useMemo } from "react";
import { Users, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useFocusPlayer } from "@/hooks/useFocusPlayer";
import { useTeamInsightsQuery } from "@/hooks/useTeams";
import { Skeleton } from "@/components/ui/skeleton";
import type { EnrichedRosterPlayer, CategoryStrengths } from "@/types/team-insights";

const POSITION_COLORS: Record<string, string> = {
  PG: "text-blue-400 bg-blue-400/10",
  SG: "text-violet-400 bg-violet-400/10",
  SF: "text-green-400 bg-green-400/10",
  PF: "text-amber-400 bg-amber-400/10",
  C: "text-red-400 bg-red-400/10",
};

// Map a stat window to the nearest available L-window field
function getWindowFpts(player: EnrichedRosterPlayer, statWindow: string): number {
  if (statWindow === "season") return player.avg_points;
  const match = statWindow.match(/^l(\d+)$/i);
  if (!match) return player.avg_fpts_l14 ?? player.avg_points;
  const n = parseInt(match[1], 10);
  if (n <= 8) return player.avg_fpts_l7 ?? player.avg_fpts_l14 ?? player.avg_points;
  if (n <= 17) return player.avg_fpts_l14 ?? player.avg_fpts_l7 ?? player.avg_points;
  return player.avg_fpts_l30 ?? player.avg_fpts_l14 ?? player.avg_points;
}

function getWindowLabel(statWindow: string): string {
  if (statWindow === "season") return "SEASON";
  const match = statWindow.match(/^l(\d+)$/i);
  if (!match) return "L14";
  const n = parseInt(match[1], 10);
  if (n <= 8) return "L7";
  if (n <= 17) return "L14";
  return "L30";
}

interface RosterRowProps {
  player: EnrichedRosterPlayer;
  isActive: boolean;
  onFocus: () => void;
  statWindow: string;
}

function TrendIndicator({ l7, l14 }: { l7: number | null; l14: number | null }) {
  if (l7 === null || l14 === null || l14 === 0) {
    return <Minus className="h-2.5 w-2.5 text-muted-foreground/40" />;
  }
  const pctChange = (l7 - l14) / l14;
  if (pctChange > 0.05) {
    return <TrendingUp className="h-2.5 w-2.5 text-green-500" />;
  }
  if (pctChange < -0.05) {
    return <TrendingDown className="h-2.5 w-2.5 text-red-500" />;
  }
  return <Minus className="h-2.5 w-2.5 text-muted-foreground/40" />;
}

function RosterRow({ player, isActive, onFocus, statWindow }: RosterRowProps) {
  const position = player.valid_positions[0] ?? "?";
  const posColor = POSITION_COLORS[position] ?? "text-muted-foreground bg-muted";
  const displayFpts = getWindowFpts(player, statWindow);

  return (
    <button
      className={cn(
        "flex items-center gap-2 w-full px-3 py-1.5 text-left transition-colors border-b border-border/20",
        "hover:bg-muted/40",
        isActive && "bg-primary/10"
      )}
      onClick={onFocus}
    >
      {/* Position badge */}
      <span
        className={cn(
          "shrink-0 inline-flex items-center justify-center w-7 h-4 rounded-sm text-[9px] font-mono font-bold uppercase tracking-wider",
          posColor
        )}
      >
        {position}
      </span>

      {/* Name + team */}
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-medium truncate block leading-none mb-0.5">
          {player.name}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
          {player.team}
        </span>
      </div>

      {/* Injury badge */}
      {player.injured && (
        <span
          className={cn(
            "shrink-0 text-[9px] font-mono font-bold uppercase px-1 py-0.5 rounded-sm leading-none",
            player.injury_status === "OUT"
              ? "text-red-500 bg-red-500/10"
              : "text-amber-500 bg-amber-500/10"
          )}
        >
          {player.injury_status ?? "OUT"}
        </span>
      )}

      {/* Trend (always L7 vs L14 as freshest signal) */}
      <TrendIndicator l7={player.avg_fpts_l7} l14={player.avg_fpts_l14} />

      {/* FPTS */}
      <div className="shrink-0 text-right w-10">
        <span className="font-mono text-xs tabular-nums text-foreground font-medium">
          {displayFpts.toFixed(1)}
        </span>
      </div>
    </button>
  );
}

const CATEGORY_STATS: { label: string; key: keyof CategoryStrengths; pct?: boolean }[] = [
  { label: "PTS", key: "avg_points" },
  { label: "REB", key: "avg_rebounds" },
  { label: "AST", key: "avg_assists" },
  { label: "STL", key: "avg_steals" },
  { label: "BLK", key: "avg_blocks" },
  { label: "TOV", key: "avg_turnovers" },
  { label: "FG%", key: "avg_fg_pct", pct: true },
  { label: "FT%", key: "avg_ft_pct", pct: true },
];

function CategoryAveragesStrip({ strengths }: { strengths: CategoryStrengths }) {
  return (
    <div className="shrink-0 border-t border-border/30 px-3 py-1.5 bg-muted/10">
      <div className="flex items-center gap-1 mb-1">
        <BarChart3 className="h-2.5 w-2.5 text-muted-foreground/50" />
        <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-mono">
          Cat Avgs · L14
        </span>
      </div>
      <div className="grid grid-cols-4 gap-x-2 gap-y-0.5">
        {CATEGORY_STATS.map(({ label, key, pct }) => (
          <div key={key} className="flex items-baseline justify-between">
            <span className="text-[9px] text-muted-foreground/60 font-mono">{label}</span>
            <span className="text-[9px] font-mono tabular-nums text-foreground">
              {pct
                ? `${strengths[key].toFixed(1)}%`
                : strengths[key].toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RosterOverviewPanel() {
  const { focusedTeamId, statWindow } = useTerminalStore();
  const focusPlayer = useFocusPlayer();
  const { data, isLoading, error } = useTeamInsightsQuery(focusedTeamId);
  const windowLabel = getWindowLabel(statWindow);

  const sortedRoster = useMemo(() => {
    if (!data?.roster) return [];
    return [...data.roster].sort(
      (a, b) => getWindowFpts(b, statWindow) - getWindowFpts(a, statWindow)
    );
  }, [data?.roster, statWindow]);

  // Team-wide aggregates
  const teamAvg = useMemo(() => {
    if (!sortedRoster.length) return null;
    const total = sortedRoster.reduce((sum, p) => sum + getWindowFpts(p, statWindow), 0);
    return total;
  }, [sortedRoster, statWindow]);

  if (!focusedTeamId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <Users className="h-7 w-7 text-muted-foreground/25" />
        <p className="text-[10px] text-muted-foreground">No team selected</p>
        <p className="text-[9px] text-muted-foreground/60">Select a team to view roster</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-2 gap-1.5">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <p className="text-[10px] text-destructive">Failed to load roster</p>
      </div>
    );
  }

  const health = data?.roster_health;
  const projWeekFpts = data?.projected_week_fpts;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Team summary strip */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-1 border-b border-border/40 bg-muted/10">
        {teamAvg !== null && (
          <span className="text-[9px] font-mono text-muted-foreground">
            Roster avg{" "}
            <span className="text-foreground tabular-nums">{teamAvg.toFixed(0)}</span>
            <span className="text-muted-foreground/50 ml-0.5">{windowLabel}</span>
          </span>
        )}
        {projWeekFpts !== null && projWeekFpts !== undefined && (
          <>
            <span className="text-muted-foreground/30 text-[9px]">·</span>
            <span className="text-[9px] font-mono text-muted-foreground">
              Proj wk{" "}
              <span className="text-primary tabular-nums">{projWeekFpts.toFixed(0)}</span>
            </span>
          </>
        )}
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-border/30 bg-muted/20 shrink-0">
        <span className="w-7 text-[9px] text-muted-foreground uppercase tracking-wider">
          POS
        </span>
        <span className="flex-1 text-[9px] text-muted-foreground uppercase tracking-wider">
          Player
        </span>
        <span className="w-4 text-[9px] text-muted-foreground uppercase tracking-wider text-center">
          TRD
        </span>
        <span className="w-10 text-[9px] text-muted-foreground uppercase tracking-wider text-right">
          {windowLabel}
        </span>
      </div>

      {/* Player rows */}
      <div className="flex-1 overflow-y-auto">
        {sortedRoster.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[10px] text-muted-foreground">No roster data</p>
          </div>
        ) : (
          sortedRoster.map((player) => (
            <RosterRow
              key={player.player_id}
              player={player}
              statWindow={statWindow}
              isActive={false}
              onFocus={() => focusPlayer(player.player_id)}
            />
          ))
        )}
      </div>

      {/* Category averages */}
      {data?.category_strengths && (
        <CategoryAveragesStrip strengths={data.category_strengths} />
      )}

      {/* Footer: roster health summary */}
      {health && (
        <div className="shrink-0 border-t border-border/30 px-3 py-1 flex items-center gap-3 bg-muted/10">
          <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-mono">
            Health
          </span>
          <span className="text-[9px] font-mono text-green-500 tabular-nums">
            {health.healthy} healthy
          </span>
          <span className="text-border/60 text-[9px]">/</span>
          <span className="text-[9px] font-mono text-amber-500 tabular-nums">
            {health.day_to_day + health.game_time_decision} DTD
          </span>
          <span className="text-border/60 text-[9px]">/</span>
          <span className="text-[9px] font-mono text-red-500 tabular-nums">
            {health.out} out
          </span>
        </div>
      )}
    </div>
  );
}
