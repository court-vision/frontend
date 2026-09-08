"use client";

import { cn } from "@/lib/utils";
import {
  formatGradedTotal,
  gradeTone,
  gradedLabel,
  gradedTotal,
  pickLabel,
  positionLabel,
  resolvePick,
  seatLabel,
  seatTitle,
  sortSeats,
  type GradeTone,
} from "@/lib/draft-recap";
import type { RecapGradedBy, RecapPick, RecapSeat } from "@/types/draft";

/**
 * The grade badge, on the badge idiom (`bg-X/15 text-X border-X/30`) with the
 * status tokens: two shades each side of neutral, and no colour for a seat
 * the room could not grade.
 */
const GRADE_CLASSES: Record<GradeTone, string> = {
  win: "border-status-win/40 bg-status-win/15 text-status-win",
  good: "border-status-win/25 bg-status-win/10 text-status-win/80",
  mid: "border-border bg-muted text-muted-foreground",
  poor: "border-status-loss/25 bg-status-loss/10 text-status-loss/80",
  loss: "border-status-loss/40 bg-status-loss/15 text-status-loss",
  none: "border-border/50 text-muted-foreground/50",
};

function totalTone(total: number | null, gradedBy: RecapGradedBy | null): string {
  if (total === null || gradedBy === "value") return "text-foreground";
  if (total > 0) return "text-status-win";
  if (total < 0) return "text-status-loss";
  return "text-muted-foreground";
}

interface RecapSeatCardsProps {
  seats: RecapSeat[];
  picks: RecapPick[];
  gradedBy: RecapGradedBy | null;
  /** The seat whose picks the table is filtered to, if any. */
  selected: number | null;
  onSelect: (slot: number) => void;
}

export function RecapSeatCards({ seats, picks, gradedBy, selected, onSelect }: RecapSeatCardsProps) {
  if (seats.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No seats to grade — this room never learned its pick order.
      </p>
    );
  }
  const ordered = sortSeats(seats);
  const positions = seats.map((s) => s.position);
  const label = gradedLabel(gradedBy);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {ordered.map((seat) => {
        const total = gradedTotal(seat, gradedBy);
        const best = resolvePick(picks, seat.best_pick);
        const worst = resolvePick(picks, seat.worst_pick);
        const active = selected === seat.slot;
        return (
          <button
            key={seat.slot}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(seat.slot)}
            className={cn(
              "rounded-md border p-2 text-left transition-colors hover:border-primary/40",
              active
                ? "border-primary/60 bg-primary/5"
                : seat.is_me
                  ? "border-primary/30 bg-primary/[0.03]"
                  : "border-border/50"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                title={seatTitle(seat)}
                className={cn("truncate text-xs font-medium", seat.is_me && "text-primary")}
              >
                {seatLabel(seat)}
              </span>
              <span
                title={seat.grade ? `Graded ${seat.grade} against the other seats in this room` : "Not graded"}
                className={cn(
                  "shrink-0 rounded border px-1.5 py-0.5 font-mono text-sm font-bold leading-none",
                  GRADE_CLASSES[gradeTone(seat.grade)]
                )}
              >
                {seat.grade ?? "—"}
              </span>
            </div>

            <div className="mt-1.5 flex items-baseline gap-1.5 font-mono text-[10px] text-muted-foreground">
              <span
                title={label.title}
                className={cn("text-sm font-bold tabular-nums", totalTone(total, gradedBy))}
              >
                {formatGradedTotal(total, gradedBy)}
              </span>
              <span title={label.title}>{label.short}</span>
              <span className="text-border">·</span>
              <span title="Rank among the seats in this room; a tie shares the place">
                {positionLabel(seat.position, positions)}
              </span>
            </div>

            <div className="mt-1.5 space-y-0.5 font-mono text-[10px] text-muted-foreground/70">
              <div className="truncate" title={best ? `Best pick: ${pickLabel(best)}` : undefined}>
                <span className="text-muted-foreground/50">best </span>
                {pickLabel(best)}
              </div>
              <div className="truncate" title={worst ? `Worst pick: ${pickLabel(worst)}` : undefined}>
                <span className="text-muted-foreground/50">worst </span>
                {pickLabel(worst)}
              </div>
              <div>
                {seat.picks} pick{seat.picks === 1 ? "" : "s"}
                {seat.unscored > 0 ? ` · ${seat.unscored} unvalued` : ""}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
