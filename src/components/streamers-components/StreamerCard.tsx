"use client";

import type { MouseEvent } from "react";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HintPopover } from "@/components/ui/hint";
import { cn } from "@/lib/utils";
import type { StreamerPlayer } from "@/types/streamer";

import { OppBadge, PositionBadges, PriorSeasonBadge, WaiversBadge } from "./StreamerBadges";
import { PlayerHeadshot } from "@/components/terminal/shared";
import { WeekSchedule } from "./WeekSchedule";

interface StreamerCardProps {
  player: StreamerPlayer;
  /** Zero-based rank in the filtered list. */
  index: number;
  showB2bBadge: boolean;
  /** First regular streamer after the breakout group. */
  showDivider: boolean;
  totalDays: number;
  /** Index of today in the matchup, or -1 when no day is (pre-season). */
  currentDay: number;
  onSelect: (player: StreamerPlayer) => void;
  /** Present only for teams that can add (ESPN); renders the + button. */
  onAdd?: (player: StreamerPlayer) => void;
  /** Why the + button is disabled, shown as a hint; null when it works. */
  addDisabledReason?: string | null;
}

/** A hint tap (popover) must not also open the player dialog. */
function stopPropagation(e: MouseEvent) {
  e.stopPropagation();
}

/**
 * Phone row for the streamers list. The name/value block is the dialog
 * trigger; the Add button and the schedule strip sit beside it (not inside —
 * they are buttons of their own, and buttons can't nest).
 */
export function StreamerCard({
  player,
  index,
  showB2bBadge,
  showDivider,
  totalDays,
  currentDay,
  onSelect,
  onAdd,
  addDisabledReason = null,
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
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => onSelect(player)}
          className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 pt-3 pb-2 text-left transition-colors active:bg-muted/50"
        >
          <div className="flex w-full min-w-0 items-center gap-2">
            <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            <PlayerHeadshot
              playerId={player.nba_player_id}
              name={player.name}
              size="xs"
            />
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
            {player.acquisition_status === "waivers" && (
              <span className="shrink-0" onClick={stopPropagation}>
                <WaiversBadge until={player.waivers_until} />
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
        {onAdd && (
          <div className="flex shrink-0 items-start pr-2 pt-2.5">
            <AddButton
              name={player.name}
              disabledReason={addDisabledReason}
              onClick={() => onAdd(player)}
            />
          </div>
        )}
      </div>
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

/**
 * The + control for a streamer, shared by the card and the table row. A
 * disabled button gets no pointer events, so the hint wraps a span instead;
 * the span also swallows the click so the row's own tap doesn't fire.
 */
export function AddButton({
  name,
  disabledReason,
  onClick,
  className,
}: {
  name: string;
  disabledReason: string | null;
  onClick: () => void;
  className?: string;
}) {
  const button = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("h-9 w-9", className)}
      aria-label={`Add ${name}`}
      disabled={!!disabledReason}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Plus className="h-4 w-4" />
    </Button>
  );
  if (!disabledReason) return button;
  return (
    <HintPopover content={<p className="text-xs">{disabledReason}</p>} contentClassName="max-w-[240px]">
      <span className="inline-flex" onClick={stopPropagation}>
        {button}
      </span>
    </HintPopover>
  );
}
