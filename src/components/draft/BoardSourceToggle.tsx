"use client";

import { cn } from "@/lib/utils";
import { playoffWeightLabel } from "@/lib/draft-board";
import type { BoardSource, DraftBoardMeta, DraftPlayoffs } from "@/types/draft";

/**
 * Whose rankings order the board.
 *
 * ESPN is the default and Court Vision the opt-in, on purpose: a projection
 * nobody can validate until the season is over should not quietly drive
 * someone's draft. In ESPN mode the room shows the order an ESPN draft room
 * shows; in Court Vision mode our rank takes the gutter and ESPN's moves to
 * the column beside the name; in "CV · my team" the gutter is Court Vision's
 * order for the roster in this room, which moves with every pick. Whichever is
 * up, the recommendation strip is CV's picks for this roster with ESPN's rank
 * on every card — the choice here is the board only.
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
  {
    key: "my_team",
    label: "CV · my team",
    title:
      "Court Vision's rankings re-ordered for your roster: your punts, and the starts your lineup " +
      "could not use. The strip above is always the top of this order",
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
  /** The league's fantasy-playoff weeks; null in roto and before the board has loaded. */
  playoffs?: DraftPlayoffs | null;
  onPlayoffWeightChange?: (weight: number) => void;
}

export function BoardSourceToggle({
  value,
  onChange,
  actual,
  reason,
  playoffs = null,
  onPlayoffWeightChange,
}: BoardSourceToggleProps) {
  const fellBack = value === "espn" && actual === "cv" ? (reason && FALLBACK[reason]) || null : null;

  return (
    <div className="ml-auto flex items-center gap-1.5">
      {playoffs && onPlayoffWeightChange && (
        <PlayoffWeight playoffs={playoffs} onChange={onPlayoffWeightChange} />
      )}
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

/**
 * How much Court Vision's value weighs the fantasy playoffs: one playoff-week
 * game counts as this many regular-season ones. It moves Court Vision's ranks
 * and the strip, never ESPN's order, and the selected value is the one the
 * server says it used.
 */
function PlayoffWeight({
  playoffs,
  onChange,
}: {
  playoffs: DraftPlayoffs;
  onChange: (weight: number) => void;
}) {
  return (
    <label
      className="mr-1.5 flex items-center gap-1 normal-case tracking-normal text-muted-foreground/60"
      title={
        `How much Court Vision's value counts a game in your fantasy playoffs (${playoffs.label}) ` +
        "against a regular-season one. 1× ignores the playoffs. ESPN's order never moves with it"
      }
    >
      playoffs
      <select
        value={playoffs.weight}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Playoff weight"
        className="rounded border border-border/60 bg-transparent px-1 py-0.5 font-mono text-[10px] text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {playoffs.weights.map((weight) => (
          <option key={weight} value={weight}>
            {playoffWeightLabel(weight)}
          </option>
        ))}
      </select>
    </label>
  );
}
