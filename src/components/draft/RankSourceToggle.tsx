"use client";

import { cn } from "@/lib/utils";
import type { DraftBoardMeta, RankSource } from "@/types/draft";

/**
 * Whose board the room drafts off.
 *
 * ESPN is the default and Court Vision is the opt-in, which is deliberate: a
 * projection nobody can validate until the season is over should not quietly
 * drive someone's draft. CV's value is what you consult when you want the
 * room-aware view — punt/push fit and lineup congestion — not the thing you get
 * by not choosing.
 *
 * `actual` is what the server actually ordered by. It differs from `value` only
 * when ESPN was asked for and no market snapshot exists yet, and the toggle
 * says so rather than showing ESPN's label over Court Vision's ordering.
 */
const OPTIONS: { key: RankSource; label: string; title: string }[] = [
  {
    key: "espn",
    label: "ESPN",
    title: "Best available on ESPN's own board for this league's format",
  },
  {
    key: "cv",
    label: "CV",
    title: "Court Vision's value, adjusted for this roster's needs and its lineup congestion",
  },
];

const RANK_TYPE_LABEL: Record<NonNullable<DraftBoardMeta["market_rank_type"]>, string> = {
  standard: "points",
  roto: "categories",
};

interface RankSourceToggleProps {
  value: RankSource;
  onChange: (source: RankSource) => void;
  /** What the server ordered by; null before the board has loaded. */
  actual: RankSource | null;
  rankType: DraftBoardMeta["market_rank_type"] | null;
}

export function RankSourceToggle({ value, onChange, actual, rankType }: RankSourceToggleProps) {
  const fellBack = value === "espn" && actual === "cv";

  return (
    <div className="ml-auto flex items-center gap-1.5">
      {fellBack && (
        <span
          className="normal-case tracking-normal text-amber-500"
          title="No ESPN draft snapshot has been taken for this season yet, so the board is ordered by Court Vision's value."
        >
          no ESPN board yet
        </span>
      )}
      {!fellBack && value === "espn" && rankType && (
        <span className="normal-case tracking-normal text-muted-foreground/70">
          {RANK_TYPE_LABEL[rankType]} board
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
