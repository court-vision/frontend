"use client";

import { Fragment, useState } from "react";
import { CalendarDays, ChevronDown, Info, Loader2, Lock, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-error";
import { HintPopover } from "@/components/ui/hint";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { CAT_VALUE_TITLE } from "@/lib/category-format";
import { formatNbaDate, formatTipTime, isActiveSlot, slotName } from "@/lib/lineup-editor";
import { writeBlockedCopy } from "@/types/lineup-editor";
import { useLineupEditor } from "./LineupEditorProvider";
import { LineupSlotRow } from "./LineupSlotRow";

const COLLAPSED_KEY = "cv.lineupEditor.collapsed";

/** The saved preference, or null when the user has never toggled the card. */
function readCollapsedPref(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(COLLAPSED_KEY);
    if (saved === "1") return true;
    if (saved === "0") return false;
  } catch {
    // storage blocked — fall back to the viewport default
  }
  return null;
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    // best effort
  }
}

/**
 * Today's ESPN board: one row per slot, tap-to-move. Renders nothing outside a
 * `LineupEditorProvider` or for a team with no board (Yahoo).
 */
export function LineupEditor({ className }: { className?: string }) {
  const editor = useLineupEditor();
  const [collapsedPref, setCollapsedPref] = useState(readCollapsedPref);
  // No saved preference: collapsed on phones, open from `md` (tracks the viewport live).
  const isMobile = useIsMobile();
  const collapsed = collapsedPref ?? isMobile;

  if (!editor) return null;
  const {
    state,
    isLoading,
    error,
    refetch,
    rows,
    staged,
    selectedPlayerId,
    selectedTargets,
    tap,
    validation,
    moveErrors,
    loadPlan,
    planStatus,
    canWrite,
    blockedReason,
  } = editor;

  if (state === null) return null;

  if (state === undefined) {
    if (error && !isLoading) {
      return (
        <Card variant="panel" className={className}>
          <QueryErrorState error={error} onRetry={refetch} compact fallback="Couldn't load today's lineup" />
        </Card>
      );
    }
    return (
      <Card variant="panel" className={cn("overflow-hidden", className)}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="divide-y divide-border/50">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="m-2 h-8 rounded" />
          ))}
        </div>
      </Card>
    );
  }

  const toggle = () => {
    const next = !collapsed;
    setCollapsedPref(next);
    writeCollapsed(next);
  };

  const errorFor = (playerId: number) =>
    moveErrors.find((e) => e.player_id === playerId) ??
    validation.find((e) => e.player_id === playerId) ??
    null;

  const valueKind = state.players[0]?.value_kind ?? "fpts";
  const active = state.players.filter((p) => isActiveSlot(p.lineup_slot_id));
  const playing = active.filter((p) => p.playable).length;
  const lockedCount = state.players.filter((p) => p.locked).length;
  const stagedCount = Object.keys(staged).length;
  const selecting = selectedPlayerId != null;

  return (
    <Card variant="panel" className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 md:px-4">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              collapsed && "-rotate-90"
            )}
          />
          <CalendarDays className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
          <span className="truncate text-sm font-semibold">Today&apos;s lineup</span>
          <span className="truncate text-xs text-muted-foreground">
            {formatNbaDate(state.nba_date)}
            {state.first_game_time_et && (
              <span className="hidden sm:inline"> · First tip {formatTipTime(state.first_game_time_et)} ET</span>
            )}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          {valueKind === "cat_value" && (
            <HintPopover content={CAT_VALUE_TITLE}>
              <span className="hidden cursor-help font-mono text-[10px] uppercase tracking-wider text-primary/80 sm:inline">
                cat val
              </span>
            </HintPopover>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => void loadPlan()}
            disabled={planStatus === "loading"}
          >
            {planStatus === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            <span className="max-sm:hidden">Optimize today</span>
            <span className="sm:hidden">Optimize</span>
          </Button>
        </div>
      </div>

      {collapsed ? (
        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span>
            <span className="font-mono text-foreground">{playing}</span>/{active.length} starters playing
          </span>
          {lockedCount > 0 && (
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3" /> {lockedCount} locked
            </span>
          )}
          {stagedCount > 0 && <span className="text-primary">{stagedCount} staged</span>}
        </div>
      ) : (
        <>
          {!canWrite && (
            <div className="flex items-start gap-2 border-t border-status-projected/30 bg-status-projected/10 px-4 py-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-projected" />
              <span>
                {writeBlockedCopy(blockedReason)}{" "}
                <span className="text-muted-foreground/70">The board is read-only.</span>
              </span>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-1.5 text-[11px] text-muted-foreground">
            {selecting ? (
              <span className="text-foreground">
                Tap a highlighted slot to move{" "}
                <span className="font-medium">
                  {editor.playerById.get(selectedPlayerId!)?.name ?? "the player"}
                </span>{" "}
                there · Esc cancels
              </span>
            ) : (
              <span>{canWrite ? "Tap a player, then the slot to move him to." : "Today's slots as ESPN has them."}</span>
            )}
            <span className="ml-auto flex items-center gap-1">
              <Lock className="h-3 w-3" /> locked at tip-off
            </span>
          </div>

          <ul role="list" className="divide-y divide-border/50 border-t border-border">
            {rows.map((row, i) => {
              const prev = rows[i - 1];
              const groupBreak =
                prev &&
                ((isActiveSlot(prev.slot_id) && !isActiveSlot(row.slot_id)) ||
                  (prev.slot_id === 12 && row.slot_id === 13));
              const player = row.player;
              const selected = !!player && player.player_id === selectedPlayerId;
              const isTarget = selecting && !selected && selectedTargets.includes(row.slot_id);
              const stagedFrom =
                player && staged[player.player_id] !== undefined ? slotName(player.lineup_slot_id) : null;
              return (
                <Fragment key={`${row.slot_id}-${row.ordinal}`}>
                  {groupBreak && <li aria-hidden className="h-1.5 bg-muted/40" />}
                  <LineupSlotRow
                    row={row}
                    valueKind={valueKind}
                    selected={selected}
                    isTarget={isTarget}
                    dimmed={selecting && !selected && !isTarget}
                    stagedFrom={stagedFrom}
                    error={player ? errorFor(player.player_id) : null}
                    interactive={canWrite}
                    onTap={() => tap(row.slot_id, player?.player_id ?? null)}
                  />
                </Fragment>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
