"use client";

import type { MouseEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StreamerPlayer } from "@/types/streamer";

import { OppBadge, PositionBadges, PriorSeasonBadge } from "./StreamerBadges";
import { WeekSchedule } from "./WeekSchedule";

interface StreamerCardProps {
  player: StreamerPlayer;
  /** Zero-based rank in the filtered list. */
  index: number;
  showB2bBadge: boolean;
  /** First regular streamer after the breakout group. */
  showDivider: boolean;
  totalDays: number;
  currentDay: number;
  onSelect: (player: StreamerPlayer) => void;
}

/** A hint tap (popover) must not also open the player dialog. */
function stopPropagation(e: MouseEvent) {
  e.stopPropagation();
}

/**
 * Phone row for the streamers list. The name/value block is the dialog
 * trigger; the schedule strip sits beside it (not inside — its day cells are
 * buttons of their own, and buttons can't nest).
 */
export function StreamerCard({
  player,
  index,
  showB2bBadge,
  showDivider,
  totalDays,
  currentDay,
  onSelect,
}: StreamerCardProps) {
  const value =
    player.avg_points_last_n !== null ? player.avg_points_last_n.toFixed(1) : "-";

  return (
    <li
      className={cn(
        "border-t border-border first:border-t-0",
        showDivider && "border-t-2 border-primary/30"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(player)}
        className="flex w-full flex-col gap-1.5 px-3 pt-3 pb-2 text-left transition-colors active:bg-muted/50"
      >
        <div className="flex w-full min-w-0 items-center gap-2">
          <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {index + 1}
          </span>
          <span className="truncate text-sm font-medium">{player.name}</span>
          {showB2bBadge && (
            <Badge variant="secondary" className="shrink-0 text-[11px]">
              B2B
            </Badge>
          )}
          {player.breakout_context && (
            <span className="shrink-0" onClick={stopPropagation}>
              <OppBadge context={player.breakout_context} />
            </span>
          )}
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {player.team}
          </span>
        </div>
        <div className="flex w-full items-center gap-2 pl-8">
          <PositionBadges positions={player.valid_positions} />
          <span className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap">
            <span className="font-mono text-sm tabular-nums">{value}</span>
            {player.avg_source === "baseline" && (
              <span onClick={stopPropagation}>
                <PriorSeasonBadge />
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              · {player.games_remaining} left
            </span>
          </span>
        </div>
      </button>
      <div className="px-3 pb-3 pl-11">
        <WeekSchedule
          gameDays={player.game_days}
          totalDays={totalDays}
          currentDay={currentDay}
          showHeader
          interactive
        />
      </div>
    </li>
  );
}
