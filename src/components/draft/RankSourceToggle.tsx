"use client";

import { cn } from "@/lib/utils";
import type { RankSource } from "@/types/draft";

/**
 * What orders the recommendation strip.
 *
 * The board itself is ESPN's in an ESPN room — that is the server's call, not
 * this toggle's — so the strip is where Court Vision's opinion lives, and it
 * opens on CV's picks: value over replacement with scarcity, roster fit and
 * lineup congestion applied, each card naming ESPN's rank beside it. "ESPN
 * next" is the opt-in: the best still available on ESPN's own board, for a
 * drafter who wants none of our opinion in the pick.
 *
 * `actual` is what the server actually ordered by. It differs from `value` only
 * when ESPN was asked for and no market snapshot exists yet, and the toggle
 * says so rather than showing ESPN's label over Court Vision's ordering.
 */
const OPTIONS: { key: RankSource; label: string; title: string }[] = [
  {
    key: "cv",
    label: "CV picks",
    title: "Court Vision's pick: value over replacement, with scarcity, roster fit and lineup congestion applied",
  },
  {
    key: "espn",
    label: "ESPN next",
    title: "The best still available on ESPN's own board for this league's format",
  },
];

interface RankSourceToggleProps {
  value: RankSource;
  onChange: (source: RankSource) => void;
  /** What the server ordered by; null before the board has loaded. */
  actual: RankSource | null;
}

export function RankSourceToggle({ value, onChange, actual }: RankSourceToggleProps) {
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
