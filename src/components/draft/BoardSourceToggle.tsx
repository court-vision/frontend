"use client";

import { cn } from "@/lib/utils";
import type { BoardSource, DraftBoardMeta } from "@/types/draft";

/**
 * Whose rankings order the board.
 *
 * ESPN is the default and Court Vision the opt-in, on purpose: a projection
 * nobody can validate until the season is over should not quietly drive
 * someone's draft. In ESPN mode the room shows the order an ESPN draft room
 * shows; in Court Vision mode our rank takes the gutter and ESPN's moves to
 * the column beside the name. Either way the recommendation strip is CV's
 * picks with ESPN's rank on every card — the choice here is the board only.
 *
 * `actual` is what the server actually ordered by. It differs from `value`
 * only when ESPN was asked for and the room cannot have it, and the toggle
 * says why rather than showing ESPN's label over Court Vision's ordering.
 */
const OPTIONS: { key: BoardSource; label: string; title: string }[] = [
  {
    key: "espn",
    label: "ESPN",
    title: "ESPN's published draft rank for this league's format — the order an ESPN draft room shows",
  },
  {
    key: "cv",
    label: "Court Vision",
    title: "Court Vision's own rankings; ESPN's rank stays in the column beside the name",
  },
];

const FALLBACK: Partial<Record<NonNullable<DraftBoardMeta["rank_basis_reason"]>, { label: string; title: string }>> = {
  no_market_snapshot: {
    label: "no ESPN board yet",
    title: "No ESPN draft snapshot has been taken for this season yet, so the board is in Court Vision's order",
  },
  provider_not_espn: {
    label: "not an ESPN league",
    title: "Only ESPN's rankings reach the platform, so this league's board is in Court Vision's order",
  },
};

interface BoardSourceToggleProps {
  value: BoardSource;
  onChange: (source: BoardSource) => void;
  /** What the server ordered by; null before the board has loaded. */
  actual: DraftBoardMeta["rank_basis"] | null;
  reason: DraftBoardMeta["rank_basis_reason"] | null;
}

export function BoardSourceToggle({ value, onChange, actual, reason }: BoardSourceToggleProps) {
  const fellBack = value === "espn" && actual === "cv" ? (reason && FALLBACK[reason]) || null : null;

  return (
    <div className="ml-auto flex items-center gap-1.5">
      <span className="normal-case tracking-normal text-muted-foreground/60">rankings</span>
      {fellBack && (
        <span className="normal-case tracking-normal text-amber-500" title={fellBack.title}>
          {fellBack.label}
        </span>
      )}
      <div className="flex overflow-hidden rounded border border-border/60">
        {OPTIONS.map((option) => (
          <button
            key={option.key}
            onClick={() => onChange(option.key)}
            title={option.title}
            aria-pressed={value === option.key}
            className={cn(
              "px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors",
              value === option.key
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
