"use client";

import type { KeyboardEvent } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { HintPopover } from "@/components/ui/hint";
import { PlayerHeadshot } from "@/components/terminal/shared";
import { getInjuryBadge } from "@/lib/injury-badge";
import { gameLabel, lockLabel, type SlotRow } from "@/lib/lineup-editor";
import type { MoveError } from "@/types/lineup-editor";
import type { ValueKind } from "@/types/scoring";

export interface LineupSlotRowProps {
  row: SlotRow;
  valueKind: ValueKind;
  /** This row's player is the one being moved. */
  selected: boolean;
  /** The selected player may move into this row's slot. */
  isTarget: boolean;
  /** A selection is active and this row is neither it nor a target. */
  dimmed: boolean;
  /** Server slot the player was staged out of ("BE"), when he moved. */
  stagedFrom: string | null;
  /** Client or server error for this player, shown inline. */
  error: MoveError | null;
  /** False when the board is read-only (no credentials, writes off…). */
  interactive: boolean;
  onTap: () => void;
}

function slotVariant(slotId: number): "default" | "secondary" | "outline" {
  if (slotId === 13) return "outline";
  if (slotId === 12) return "secondary";
  return "default";
}

/**
 * One slot instance on the editor board — a 44 px tap target. Tap a player to
 * select him; while a selection is active, eligible rows (players and empty
 * seats alike) light up and a tap there stages the move or swap.
 */
export function LineupSlotRow({
  row,
  valueKind,
  selected,
  isTarget,
  dimmed,
  stagedFrom,
  error,
  interactive,
  onTap,
}: LineupSlotRowProps) {
  const { player } = row;
  const locked = !!player?.locked;
  const lock = player ? lockLabel(player) : null;
  const tappable = interactive && (isTarget || (!!player && !locked));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!tappable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTap();
    }
  };

  return (
    <li>
      <div
        role="button"
        tabIndex={tappable ? 0 : -1}
        aria-pressed={selected || undefined}
        aria-disabled={!tappable || undefined}
        aria-label={
          player
            ? `${row.slot}: ${player.name}${locked ? ", locked" : ""}${isTarget ? ", swap here" : ""}`
            : `${row.slot}: empty${isTarget ? ", move here" : ""}`
        }
        onClick={tappable ? onTap : undefined}
        onKeyDown={onKeyDown}
        className={cn(
          "flex min-h-[44px] items-center gap-2 border-l-2 border-l-transparent px-3 py-1 transition-colors max-md:gap-1.5 max-md:px-2",
          tappable && "cursor-pointer hover:bg-muted/40",
          selected && "border-l-primary bg-primary/10",
          isTarget && "border-l-status-win bg-status-win/10 ring-1 ring-inset ring-status-win/30",
          dimmed && "opacity-40",
          error && "bg-status-loss/5"
        )}
      >
        <Badge
          variant={slotVariant(row.slot_id)}
          className={cn(
            "w-11 shrink-0 justify-center font-mono max-md:w-9 max-md:px-0 max-md:text-[10px]",
            row.slot_id === 13 && "text-muted-foreground"
          )}
        >
          {row.slot}
        </Badge>

        {player ? (
          <>
            <PlayerHeadshot playerId={player.nba_player_id} name={player.name} size="xs" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className={cn("truncate text-sm font-medium", !player.playable && "text-muted-foreground")}>
                  {player.name}
                </span>
                <span className="hidden text-xs text-muted-foreground md:inline">{player.team}</span>
                {getInjuryBadge(player.injury_status)}
                {stagedFrom && (
                  <span
                    className="shrink-0 rounded border border-primary/25 bg-primary/10 px-1 font-mono text-[10px] uppercase text-primary"
                    title={`Moved from ${stagedFrom}`}
                  >
                    <span className="max-md:hidden">was {stagedFrom}</span>
                    <span className="md:hidden">←{stagedFrom}</span>
                  </span>
                )}
              </div>
              {error && (
                <p className="hidden truncate text-[11px] text-status-loss md:block">{error.message}</p>
              )}
            </div>
            <span
              className={cn(
                "w-[124px] shrink-0 truncate text-right font-mono text-[11px] max-md:w-[80px] max-md:text-[10px]",
                player.has_game_today ? "text-muted-foreground" : "text-muted-foreground/50"
              )}
            >
              <span className="max-md:hidden">{gameLabel(player)}</span>
              <span className="md:hidden">{gameLabel(player, { compact: true })}</span>
            </span>
            <span
              className={cn(
                "w-12 shrink-0 text-right font-mono text-sm tabular-nums max-md:w-9 max-md:text-[13px]",
                valueKind === "cat_value" && "text-primary/90"
              )}
            >
              {player.avg_points.toFixed(1)}
            </span>
          </>
        ) : (
          <span className="flex-1 text-xs italic text-muted-foreground">
            {isTarget ? "Move here" : "Empty"}
          </span>
        )}

        <span className="flex w-10 shrink-0 items-center justify-end max-md:w-7">
          {isTarget ? (
            <span className="font-mono text-[10px] uppercase text-status-win">
              {player ? "swap" : "here"}
            </span>
          ) : error ? (
            <HintPopover content={error.message}>
              <span
                className="inline-flex h-6 w-6 items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-status-loss" aria-label={error.message} />
              </span>
            </HintPopover>
          ) : lock ? (
            <HintPopover content={lock}>
              <span
                className="inline-flex h-6 w-6 items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label={lock} />
              </span>
            </HintPopover>
          ) : null}
        </span>
      </div>
    </li>
  );
}
