"use client";

import { useCallback, useState, type MouseEvent } from "react";
import { ArrowLeftRight, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { HintPopover } from "@/components/ui/hint";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { lockLabel, occupants, slotCapacity, slotName } from "@/lib/lineup-editor";
import type { LineupPlayer } from "@/types/lineup-editor";
import { useLineupEditor, type LineupEditorContextValue } from "./LineupEditorProvider";

/** How one roster-table row relates to the editor's current selection. */
export interface RowDecor {
  lp: LineupPlayer;
  /** Slot after staging. */
  assigned: number;
  /** Set when the player was staged out of his server slot. */
  stagedTo: number | null;
  selected: boolean;
  /** The selected player may move into this row's slot. */
  isTarget: boolean;
  dimmed: boolean;
  locked: boolean;
}

/**
 * Editor glue for a roster table that is not slot-ordered (the matchup
 * tables): join rows to the board by ESPN `player_id`, decide what a row tap
 * does while a selection is active, and drive the phone target sheet.
 * `ed` is null whenever the table should render exactly as before (opponent,
 * Yahoo, no board yet).
 */
export function useEditableRows(editable: boolean | undefined) {
  const editor = useLineupEditor();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const ed: LineupEditorContextValue | null = editable && editor?.state ? editor : null;

  const decorate = useCallback(
    (playerId: number): RowDecor | null => {
      if (!ed) return null;
      const lp = ed.playerById.get(playerId);
      if (!lp) return null;
      const assigned = ed.assignment.get(playerId) ?? lp.lineup_slot_id;
      const selected = ed.selectedPlayerId === playerId;
      const selecting = ed.selectedPlayerId != null;
      const isTarget = selecting && !selected && ed.selectedTargets.includes(assigned);
      return {
        lp,
        assigned,
        stagedTo: assigned !== lp.lineup_slot_id ? assigned : null,
        selected,
        isTarget,
        dimmed: selecting && !selected && !isTarget,
        locked: lp.locked,
      };
    },
    [ed]
  );

  /** Row click: acts on the selection when one is active, else runs the table's own handler. */
  const handleRowClick = useCallback(
    (playerId: number, fallback: () => void) => {
      if (!ed || ed.selectedPlayerId == null) {
        fallback();
        return;
      }
      const decor = decorate(playerId);
      if (!decor) {
        ed.select(null);
        return;
      }
      if (decor.selected) ed.select(null);
      else if (decor.isTarget) ed.stage(ed.selectedPlayerId, decor.assigned);
      else if (!decor.locked) ed.select(playerId);
    },
    [ed, decorate]
  );

  /** The Move button: select the player (phones also open the slot picker). */
  const beginMove = useCallback(
    (playerId: number) => {
      if (!ed) return;
      ed.select(playerId);
      if (isMobile) setSheetOpen(true);
    },
    [ed, isMobile]
  );

  const onSheetOpenChange = useCallback(
    (open: boolean) => {
      setSheetOpen(open);
      if (!open) ed?.select(null);
    },
    [ed]
  );

  /** Eligible slots with an open seat — they have no row of their own to tap. */
  const openTargets =
    ed && ed.state && ed.selectedPlayerId != null
      ? ed.selectedTargets.filter(
          (slot) => occupants(ed.state!, ed.staged, slot).length < slotCapacity(ed.state!, slot)
        )
      : [];

  return { ed, decorate, handleRowClick, beginMove, sheetOpen, onSheetOpenChange, openTargets, isMobile };
}

/** Slot badge that shows a staged change as `~~BE~~ UT`. */
export function EditableSlotBadge({ slot, stagedTo }: { slot: string; stagedTo: number | null }) {
  const variant = (s: string) => (s === "IR" ? "outline" : s === "BE" ? "secondary" : "default");
  if (stagedTo === null) {
    return (
      <Badge variant={variant(slot)} className={slot === "IR" ? "text-muted-foreground" : ""}>
        {slot}
      </Badge>
    );
  }
  const next = slotName(stagedTo);
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant="neutral" className="line-through opacity-60">
        {slot}
      </Badge>
      <Badge variant={variant(next)} className="ring-1 ring-primary/40">
        {next}
      </Badge>
    </span>
  );
}

interface MoveButtonProps {
  decor: RowDecor;
  canWrite: boolean;
  onBegin: () => void;
  onCancel: () => void;
  onStage: () => void;
}

/** The per-row affordance in the player cell: Move / Cancel / Swap, or the lock. */
export function MoveButton({ decor, canWrite, onBegin, onCancel, onStage }: MoveButtonProps) {
  const stop = (e: MouseEvent, fn: () => void) => {
    e.stopPropagation();
    fn();
  };
  const lock = lockLabel(decor.lp);
  if (lock) {
    return (
      <HintPopover content={lock}>
        <span
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Lock className="h-3 w-3 text-muted-foreground" aria-label={lock} />
        </span>
      </HintPopover>
    );
  }
  if (!canWrite) return null;
  if (decor.isTarget) {
    return (
      <button
        type="button"
        onClick={(e) => stop(e, onStage)}
        className="touch-hit inline-flex h-6 shrink-0 items-center gap-1 rounded border border-status-win/40 bg-status-win/10 px-1.5 font-mono text-[10px] uppercase text-status-win"
      >
        <ArrowLeftRight className="h-3 w-3" /> swap
      </button>
    );
  }
  if (decor.selected) {
    return (
      <button
        type="button"
        aria-label={`Cancel moving ${decor.lp.name}`}
        onClick={(e) => stop(e, onCancel)}
        className="touch-hit inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/15 text-primary"
      >
        <X className="h-3 w-3" />
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-label={`Move ${decor.lp.name}`}
      onClick={(e) => stop(e, onBegin)}
      className={cn(
        "touch-hit inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground",
        "hover:bg-muted hover:text-foreground"
      )}
    >
      <ArrowLeftRight className="h-3 w-3" />
    </button>
  );
}

/** Row classes for a decorated row (selection highlight, target ring, dimming). */
export function editableRowClass(decor: RowDecor | null): string {
  if (!decor) return "";
  return cn(
    decor.selected && "bg-primary/10 border-l-primary",
    decor.isTarget && "bg-status-win/10 border-l-status-win hover:bg-status-win/15",
    decor.dimmed && "opacity-40"
  );
}
