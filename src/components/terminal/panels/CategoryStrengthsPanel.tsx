"use client";

import { BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useTeamInsightsQuery } from "@/hooks/useTeams";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryStrengths } from "@/types/team-insights";

interface CategoryConfig {
  key: keyof CategoryStrengths;
  label: string;
  max: number;
  isPct: boolean;
}

const CATEGORIES: CategoryConfig[] = [
  { key: "avg_points",   label: "PTS",  max: 200,  isPct: false },
  { key: "avg_rebounds", label: "REB",  max: 50,   isPct: false },
  { key: "avg_assists",  label: "AST",  max: 30,   isPct: false },
  { key: "avg_steals",   label: "STL",  max: 8,    isPct: false },
  { key: "avg_blocks",   label: "BLK",  max: 8,    isPct: false },
  { key: "avg_fg_pct",   label: "FG%",  max: 1.0,  isPct: true  },
  { key: "avg_ft_pct",   label: "FT%",  max: 1.0,  isPct: true  },
];

interface CategoryRowProps {
  config: CategoryConfig;
  value: number;
}

function CategoryRow({ config, value }: CategoryRowProps) {
  const pct = Math.min(Math.max(value / config.max, 0), 1);
  const displayValue = config.isPct
    ? (value * 100).toFixed(1) + "%"
    : value.toFixed(1);

  // Determine bar color tier based on fill percentage
  const barColor =
    pct >= 0.7
      ? "bg-violet-500"
      : pct >= 0.45
      ? "bg-blue-500"
      : "bg-blue-500/50";

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      {/* Category label */}
      <span className="shrink-0 w-7 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
        {config.label}
      </span>

      {/* Bar track */}
      <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${(pct * 100).toFixed(2)}%` }}
        />
      </div>

      {/* Value */}
      <span className="shrink-0 w-12 text-right font-mono text-[10px] tabular-nums text-foreground/90">
        {displayValue}
      </span>
    </div>
  );
}

export function CategoryStrengthsPanel() {
  const { focusedTeamId } = useTerminalStore();
  const { data, isLoading, error } = useTeamInsightsQuery(focusedTeamId);

  if (!focusedTeamId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <BarChart2 className="h-7 w-7 text-muted-foreground/25" />
        <p className="text-[10px] text-muted-foreground">No team selected</p>
        <p className="text-[9px] text-muted-foreground/60">Select a team to view category strengths</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-2 gap-2">
        {[...Array(7)].map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <p className="text-[10px] text-destructive">Failed to load category data</p>
      </div>
    );
  }

  const strengths = data?.category_strengths;

  if (!strengths) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <BarChart2 className="h-7 w-7 text-muted-foreground/25" />
        <p className="text-[10px] text-muted-foreground">No category data available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Column headers */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1 border-b border-border/30 bg-muted/20">
        <span className="w-7 text-[9px] text-muted-foreground uppercase tracking-wider">
          Cat
        </span>
        <span className="flex-1 text-[9px] text-muted-foreground uppercase tracking-wider">
          Distribution
        </span>
        <span className="w-12 text-[9px] text-muted-foreground uppercase tracking-wider text-right">
          Avg
        </span>
      </div>

      {/* Category bars */}
      <div className="flex-1 overflow-y-auto py-1">
        {CATEGORIES.map((cat) => (
          <CategoryRow
            key={cat.key}
            config={cat}
            value={strengths[cat.key]}
          />
        ))}
      </div>

      {/* Footer note */}
      <div className="shrink-0 border-t border-border/30 px-3 py-1 flex items-center justify-between bg-muted/10">
        <span className="text-[9px] font-mono text-muted-foreground/50">
          L14 window averages &middot; team totals
        </span>
        {data?.projected_week_fpts !== null && data?.projected_week_fpts !== undefined && (
          <span className="text-[9px] font-mono tabular-nums text-muted-foreground/60">
            Proj{" "}
            <span className="text-foreground/80 font-medium">
              {data.projected_week_fpts.toFixed(1)}
            </span>{" "}
            fpts
          </span>
        )}
      </div>
    </div>
  );
}
