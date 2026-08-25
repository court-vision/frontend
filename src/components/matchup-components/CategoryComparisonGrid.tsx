"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  barShare,
  formatCategoryValue,
  formatMakesAttempts,
  formatRecord,
  polarityGlyph,
  recordOutcome,
  winModeLabel,
  winnerBadgeVariant,
} from "@/lib/category-format";
import type { CategoryComparison, CategoryScoreItem, CategoryWinMode } from "@/types/scoring";

interface CategoryComparisonGridProps {
  comparison: CategoryComparison;
  /** Optional projected comparison; enables the Current/Projected toggle. */
  projected?: CategoryComparison | null;
  yourName: string;
  oppName: string;
  /** Raw makes/attempts (from `CategoryTeamScore.raw`) for the rate sublabels. */
  yourRaw?: Record<string, number> | null;
  oppRaw?: Record<string, number> | null;
  liveAdjusted?: boolean;
  winMode?: CategoryWinMode | null;
  /** `full` = card with header; `compact` = bare dense grid (terminal, daily view). */
  variant?: "full" | "compact";
  defaultShowProjected?: boolean;
  title?: string;
  className?: string;
}

function ModeToggle({
  showProjected,
  onChange,
  compact,
}: {
  showProjected: boolean;
  onChange: (v: boolean) => void;
  compact?: boolean;
}) {
  const btn = (active: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2 font-medium transition-colors",
        compact ? "py-0.5 text-[10px]" : "py-1 text-[11px]",
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="flex rounded-md border border-border overflow-hidden shrink-0">
      {btn(!showProjected, "Current", () => onChange(false))}
      {btn(showProjected, "Projected", () => onChange(true))}
    </div>
  );
}

function CategoryCell({
  item,
  yourRaw,
  oppRaw,
  compact,
}: {
  item: CategoryScoreItem;
  yourRaw?: Record<string, number> | null;
  oppRaw?: Record<string, number> | null;
  compact?: boolean;
}) {
  const share = barShare(item.you, item.opp, item.higher_is_better);
  const youWin = item.winner === "you";
  const oppWin = item.winner === "opp";
  const tie = item.winner === "tie";
  const glyph = polarityGlyph(item);
  const yourMA = compact ? null : formatMakesAttempts(yourRaw, item.key);
  const oppMA = compact ? null : formatMakesAttempts(oppRaw, item.key);

  return (
    <div
      className={cn(
        "rounded-md border flex flex-col min-w-0",
        compact ? "px-1.5 py-1 gap-0.5" : "px-2 py-1.5 gap-1",
        youWin && "border-status-win/30 bg-status-win/10",
        oppWin && "border-status-loss/30 bg-status-loss/10",
        tie && "border-border bg-muted/20"
      )}
      title={`${item.label}: ${formatCategoryValue(item.you, item)} vs ${formatCategoryValue(item.opp, item)}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">
          {item.label}
          {glyph && <span className="ml-0.5 text-muted-foreground/70">{glyph}</span>}
        </span>
        {!tie && (
          <span
            className={cn(
              "text-[9px] font-mono font-bold uppercase shrink-0",
              youWin ? "text-status-win" : "text-status-loss"
            )}
          >
            {youWin ? "W" : "L"}
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-1">
        <span
          className={cn(
            "font-mono tabular-nums font-bold truncate",
            compact ? "text-xs" : "text-sm",
            youWin ? "text-status-win" : "text-foreground"
          )}
        >
          {formatCategoryValue(item.you, item)}
        </span>
        <span
          className={cn(
            "font-mono tabular-nums truncate",
            compact ? "text-[10px]" : "text-xs",
            oppWin ? "text-status-loss" : "text-muted-foreground"
          )}
        >
          {formatCategoryValue(item.opp, item)}
        </span>
      </div>
      {(yourMA || oppMA) && (
        <div className="flex items-center justify-between gap-1 text-[9px] font-mono text-muted-foreground/60">
          <span className="truncate">{yourMA ?? ""}</span>
          <span className="truncate">{oppMA ?? ""}</span>
        </div>
      )}
      <div className="flex h-1 rounded-full overflow-hidden bg-muted/40">
        <div
          className={cn(
            "h-full transition-[width] duration-500",
            youWin ? "bg-status-win" : tie ? "bg-muted-foreground/40" : "bg-muted-foreground/25"
          )}
          style={{ width: `${(share * 100).toFixed(1)}%` }}
        />
        <div
          className={cn(
            "h-full flex-1",
            oppWin ? "bg-status-loss" : tie ? "bg-muted-foreground/40" : "bg-muted-foreground/10"
          )}
        />
      </div>
    </div>
  );
}

/**
 * Per-category you-vs-opponent grid for H2H category leagues. Cells are tinted
 * by who leads each category; ties are neutral. Rates show makes/attempts when
 * raw totals are available.
 */
export function CategoryComparisonGrid({
  comparison,
  projected,
  yourName,
  oppName,
  yourRaw,
  oppRaw,
  liveAdjusted = false,
  winMode,
  variant = "full",
  defaultShowProjected = false,
  title = "Category Breakdown",
  className,
}: CategoryComparisonGridProps) {
  const [showProjected, setShowProjected] = useState(defaultShowProjected && !!projected);
  const usingProjected = showProjected && !!projected;
  const active = usingProjected ? (projected as CategoryComparison) : comparison;
  const outcome = recordOutcome(active.wins, active.losses);
  const record = formatRecord(active.wins, active.losses, active.ties);
  const compact = variant === "compact";
  const mode = winMode ? winModeLabel(winMode) : null;

  const cells = (
    <div
      className={cn(
        "grid gap-1.5",
        compact
          ? "grid-cols-3 sm:grid-cols-5 xl:grid-cols-9"
          : "grid-cols-3 sm:grid-cols-5 lg:grid-cols-[repeat(auto-fit,minmax(88px,1fr))]"
      )}
    >
      {active.items.map((item) => (
        <CategoryCell
          key={item.key}
          item={item}
          yourRaw={usingProjected ? null : yourRaw}
          oppRaw={usingProjected ? null : oppRaw}
          compact={compact}
        />
      ))}
    </div>
  );

  if (compact) {
    return (
      <div className={cn("space-y-1.5", className)}>
        {projected && (
          <div className="flex items-center justify-between gap-2">
            <Badge variant={winnerBadgeVariant(outcome)} className="text-[10px]">
              {record}
            </Badge>
            <ModeToggle showProjected={usingProjected} onChange={setShowProjected} compact />
          </div>
        )}
        {cells}
      </div>
    );
  }

  return (
    <Card variant="panel" className={cn("p-4 space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display font-bold text-sm tracking-wide">{title}</h3>
        <Badge variant={winnerBadgeVariant(outcome)}>{record}</Badge>
        {liveAdjusted && !usingProjected && (
          <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-status-win">
            <span className="h-1.5 w-1.5 rounded-full bg-status-win animate-pulse" />
            Live
          </span>
        )}
        {mode && <span className="text-[11px] text-muted-foreground/70">{mode}</span>}
        {projected && (
          <div className="ml-auto">
            <ModeToggle showProjected={usingProjected} onChange={setShowProjected} />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground px-0.5">
        <span className="truncate">
          <span className="text-foreground font-medium">{yourName}</span>
          {usingProjected && " · projected"}
        </span>
        <span className="truncate text-right">{oppName}</span>
      </div>
      {cells}
    </Card>
  );
}

export function CategoryGridSkeleton({ cells = 9, compact = false }: { cells?: number; compact?: boolean }) {
  const grid = (
    <div className={cn("grid gap-1.5", compact ? "grid-cols-3 sm:grid-cols-5 xl:grid-cols-9" : "grid-cols-3 sm:grid-cols-5 lg:grid-cols-9")}>
      {Array.from({ length: cells }).map((_, i) => (
        <Skeleton key={i} className={compact ? "h-10 w-full" : "h-16 w-full"} />
      ))}
    </div>
  );
  if (compact) return grid;
  return (
    <Card variant="panel" className="p-4 space-y-3">
      <Skeleton className="h-4 w-40" />
      {grid}
    </Card>
  );
}
