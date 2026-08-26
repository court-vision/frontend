"use client";

import { BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useTeamInsightsQuery } from "@/hooks/useTeams";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-error";
import {
  barShare,
  formatCategoryValue,
  formatRecord,
  polarityGlyph,
  recordOutcome,
  OUTCOME_CLASSES,
} from "@/lib/category-format";
import type { CategoryScoreItem } from "@/types/scoring";
import type { CategoryStrengths } from "@/types/team-insights";

/** Strengths-only fallback rows (no opponent this week). */
const STRENGTH_ROWS: { key: keyof CategoryStrengths; label: string; is_rate: boolean; higher_is_better: boolean }[] = [
  { key: "avg_fg_pct", label: "FG%", is_rate: true, higher_is_better: true },
  { key: "avg_ft_pct", label: "FT%", is_rate: true, higher_is_better: true },
  { key: "avg_fg3m", label: "3PM", is_rate: false, higher_is_better: true },
  { key: "avg_points", label: "PTS", is_rate: false, higher_is_better: true },
  { key: "avg_rebounds", label: "REB", is_rate: false, higher_is_better: true },
  { key: "avg_assists", label: "AST", is_rate: false, higher_is_better: true },
  { key: "avg_steals", label: "STL", is_rate: false, higher_is_better: true },
  { key: "avg_blocks", label: "BLK", is_rate: false, higher_is_better: true },
  { key: "avg_turnovers", label: "TO", is_rate: false, higher_is_better: false },
];

function ComparisonRow({ item }: { item: CategoryScoreItem }) {
  const share = barShare(item.you, item.opp, item.higher_is_better);
  const youWin = item.winner === "you";
  const oppWin = item.winner === "opp";
  return (
    <div className="flex items-center gap-2 px-3 py-1" title={`${item.label}: you ${formatCategoryValue(item.you, item)} · opp ${formatCategoryValue(item.opp, item)}`}>
      <span className="shrink-0 w-8 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
        {item.label}
        {polarityGlyph(item) && <span className="text-muted-foreground/60">{polarityGlyph(item)}</span>}
      </span>
      <span
        className={cn(
          "shrink-0 w-11 text-right font-mono text-[10px] tabular-nums",
          youWin ? "text-status-win font-semibold" : "text-foreground/80"
        )}
      >
        {formatCategoryValue(item.you, item)}
      </span>
      {/* Diverging bar: your share grows from the center leftwards, opp's rightwards */}
      <div className="flex-1 h-1.5 flex items-center">
        <div className="flex-1 flex justify-end">
          <div
            className={cn("h-1.5 rounded-l-full transition-all duration-500", youWin ? "bg-status-win" : "bg-muted-foreground/30")}
            style={{ width: `${(share * 100).toFixed(1)}%` }}
          />
        </div>
        <div className="w-px h-2.5 bg-border shrink-0" />
        <div className="flex-1">
          <div
            className={cn("h-1.5 rounded-r-full transition-all duration-500", oppWin ? "bg-status-loss" : "bg-muted-foreground/30")}
            style={{ width: `${((1 - share) * 100).toFixed(1)}%` }}
          />
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 w-11 text-left font-mono text-[10px] tabular-nums",
          oppWin ? "text-status-loss font-semibold" : "text-muted-foreground"
        )}
      >
        {formatCategoryValue(item.opp, item)}
      </span>
    </div>
  );
}

function StrengthRow({ label, value, isRate, glyph }: { label: string; value: number; isRate: boolean; glyph: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1">
      <span className="shrink-0 w-8 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
        {label}
        {glyph && <span className="text-muted-foreground/60">{glyph}</span>}
      </span>
      <span className="flex-1" />
      <span className="shrink-0 w-14 text-right font-mono text-[10px] tabular-nums text-foreground/90">
        {formatCategoryValue(value, { is_rate: isRate })}
      </span>
    </div>
  );
}

export function CategoryStrengthsPanel() {
  const { focusedTeamId } = useTerminalStore();
  const { data, isLoading, error, refetch, isFetching } = useTeamInsightsQuery(focusedTeamId);

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
        {[...Array(9)].map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <QueryErrorState
        error={error}
        onRetry={() => refetch()}
        isRetrying={isFetching}
        compact
        className="h-full"
      />
    );
  }

  const strengths = data?.category_strengths ?? null;
  const comparison = data?.category_comparison ?? null;

  if (!strengths && !comparison) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <BarChart2 className="h-7 w-7 text-muted-foreground/25" />
        <p className="text-[10px] text-muted-foreground">No category data available</p>
      </div>
    );
  }

  const windowDays = strengths?.window_days ?? 14;
  const outcome = comparison ? recordOutcome(comparison.wins, comparison.losses) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Column headers */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1 border-b border-border/30 bg-muted/20">
        <span className="w-8 text-[9px] text-muted-foreground uppercase tracking-wider">Cat</span>
        {comparison ? (
          <>
            <span className="w-11 text-right text-[9px] text-primary/70 uppercase tracking-wider">You</span>
            <span className="flex-1 text-center text-[9px] text-muted-foreground uppercase tracking-wider">
              Per game · L{windowDays}
            </span>
            <span className="w-11 text-left text-[9px] text-muted-foreground uppercase tracking-wider">Opp</span>
          </>
        ) : (
          <>
            <span className="flex-1 text-[9px] text-muted-foreground uppercase tracking-wider">
              Per game · L{windowDays}
            </span>
            <span className="w-14 text-[9px] text-muted-foreground uppercase tracking-wider text-right">You</span>
          </>
        )}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto py-1">
        {comparison
          ? comparison.items.map((item) => <ComparisonRow key={item.key} item={item} />)
          : strengths &&
            STRENGTH_ROWS.map((row) => (
              <StrengthRow
                key={row.key}
                label={row.label}
                value={strengths[row.key]}
                isRate={row.is_rate}
                glyph={polarityGlyph(row)}
              />
            ))}
      </div>

      {/* Footer note */}
      <div className="shrink-0 border-t border-border/30 px-3 py-1 flex items-center justify-between bg-muted/10">
        <span className="text-[9px] font-mono text-muted-foreground/50">
          {comparison ? "vs this week's opponent" : "No opponent this week"} · team per-game totals
        </span>
        {comparison && outcome ? (
          <span className={cn("text-[9px] font-mono tabular-nums font-semibold", OUTCOME_CLASSES[outcome].text)}>
            {formatRecord(comparison.wins, comparison.losses, comparison.ties)}
          </span>
        ) : (
          data?.projected_week_fpts !== null &&
          data?.projected_week_fpts !== undefined && (
            <span className="text-[9px] font-mono tabular-nums text-muted-foreground/60">
              Proj{" "}
              <span className="text-foreground/80 font-medium">{data.projected_week_fpts.toFixed(1)}</span>{" "}
              fpts
            </span>
          )
        )}
      </div>
    </div>
  );
}
