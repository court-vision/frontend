"use client";

import { useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import { AlertTriangle, ArrowLeftRight, Lock, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { HintPopover } from "@/components/ui/hint";
import { PlayerHeadshot } from "@/components/terminal/shared";
import { getInjuryBadge } from "@/lib/injury-badge";
import { gameLabel, lockLabel, type SlotRow } from "@/lib/lineup-editor";
import type { MoveError } from "@/types/lineup-editor";
import type { ValueKind } from "@/types/scoring";

/** Phone swipe actions: swipe the row left to reveal Move (and Drop). */
export interface SlotRowSwipe {
  revealed: boolean;
  onReveal: (open: boolean) => void;
  onMove: () => void;
  onDrop: () => void;
  canDrop: boolean;
}

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
  /** Present on phones for a movable player: the row can be swiped left. */
  swipe?: SlotRowSwipe;
}

/** Width of one revealed action, px. */
const ACTION_W = 64;
/** Finger travel before a touch is treated as a horizontal swipe, not a scroll. */
const AXIS_LOCK_PX = 6;

function slotVariant(slotId: number): "default" | "secondary" | "outline" {
  if (slotId === 13) return "outline";
  if (slotId === 12) return "secondary";
  return "default";
}

/**
 * One slot instance on the editor board — a 44 px tap target. Tap a player to
 * select him; while a selection is active, eligible rows (players and empty
 * seats alike) light up and a tap there stages the move or swap. On phones a
 * row also swipes left to reveal Move and Drop, and a tap opens the picker.
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
  swipe,
}: LineupSlotRowProps) {
  const { player } = row;
  const locked = !!player?.locked;
  const lock = player ? lockLabel(player) : null;
  const tappable = interactive && (isTarget || (!!player && !locked));
  const swipeable = !!swipe && !!player && !locked && interactive;
  const revealWidth = swipeable ? ACTION_W * (swipe!.canDrop ? 2 : 1) : 0;

  // Live drag offset (px, 0..revealWidth) while a finger is on the row; null at rest.
  const [drag, setDrag] = useState<number | null>(null);
  const touch = useRef<{ x: number; y: number; base: number; axis: "x" | "y" | null } | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    if (!swipeable) return;
    const t = e.touches[0];
    if (!t) return;
    touch.current = { x: t.clientX, y: t.clientY, base: swipe!.revealed ? revealWidth : 0, axis: null };
  };
  const onTouchMove = (e: TouchEvent) => {
    const start = touch.current;
    const t = e.touches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (start.axis === null) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      start.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (start.axis !== "x") return;
    setDrag(Math.min(revealWidth, Math.max(0, start.base - dx)));
  };
  const onTouchEnd = () => {
    const start = touch.current;
    touch.current = null;
    if (!start || start.axis !== "x") return;
    const shift = drag ?? start.base;
    setDrag(null);
    swipe!.onReveal(shift > revealWidth / 2);
  };

  const shift = drag ?? (swipeable && swipe!.revealed ? revealWidth : 0);

  const handleTap = () => {
    if (swipeable && swipe!.revealed) {
      swipe!.onReveal(false);
      return;
    }
    onTap();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!tappable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTap();
    }
  };

  return (
    <li className={cn(swipeable && "relative overflow-hidden")}>
      {swipeable && (
        <div className="absolute inset-y-0 right-0 flex" aria-hidden={!swipe!.revealed}>
          <button
            type="button"
            tabIndex={swipe!.revealed ? 0 : -1}
            onClick={swipe!.onMove}
            className="flex w-16 flex-col items-center justify-center gap-0.5 bg-primary text-[10px] font-semibold text-primary-foreground"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Move
          </button>
          {swipe!.canDrop && (
            <button
              type="button"
              tabIndex={swipe!.revealed ? 0 : -1}
              onClick={swipe!.onDrop}
              className="flex w-16 flex-col items-center justify-center gap-0.5 bg-status-loss text-[10px] font-semibold text-background"
            >
              <UserMinus className="h-4 w-4" />
              Drop
            </button>
          )}
        </div>
      )}
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
        onClick={tappable ? handleTap : undefined}
        onKeyDown={onKeyDown}
        onTouchStart={swipeable ? onTouchStart : undefined}
        onTouchMove={swipeable ? onTouchMove : undefined}
        onTouchEnd={swipeable ? onTouchEnd : undefined}
        onTouchCancel={swipeable ? onTouchEnd : undefined}
        style={
          swipeable
            ? {
                transform: `translateX(-${shift}px)`,
                transition: drag === null ? "transform 220ms cubic-bezier(0.2, 0.9, 0.3, 1.1)" : "none",
              }
            : undefined
        }
        className={cn(
          "flex min-h-[44px] items-center gap-2 border-l-2 border-l-transparent px-3 py-1 transition-colors max-md:gap-1.5 max-md:px-2",
          swipeable && "relative touch-pan-y bg-card",
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
