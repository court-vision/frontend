"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { SlideToConfirm } from "@/components/ui/slide-to-confirm";
import { userMessage } from "@/lib/api-error";
import { gameLabel, occupants, slotCapacity, slotName, swapPartner } from "@/lib/lineup-editor";
import { transactionError } from "@/lib/roster-transaction";
import { useLineupEditor } from "./LineupEditorProvider";

interface LineupTargetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Offer "Drop" as a destination. Off in the matchup tables, on for the board. */
  allowDrop?: boolean;
  /** Open with Drop already chosen (a row's swipe asked for the drop). */
  defaultDrop?: boolean;
}

type Pick = number | "drop" | null;

/**
 * Phone picker for one player: tap the destination — an eligible slot, who
 * swaps out of it, or the drop — then slide. The move is sent to ESPN on its
 * own, the way ESPN's app works; nothing is staged, so there is no second
 * confirm. The optimizer keeps the staged list and its own confirm for the
 * bulk case.
 */
export function LineupTargetSheet({
  open,
  onOpenChange,
  allowDrop = false,
  defaultDrop = false,
}: LineupTargetSheetProps) {
  const editor = useLineupEditor();
  const state = editor?.state;
  const selected = editor?.selectedPlayerId ?? null;
  const current = selected != null ? editor?.playerById.get(selected) : undefined;
  // The selection clears as the drawer closes; keep naming the player it was
  // about through the close animation.
  const [player, setPlayer] = useState(current);
  useEffect(() => {
    if (current) setPlayer(current);
  }, [current]);

  const [pick, setPick] = useState<Pick>(null);
  useEffect(() => {
    if (open) setPick(defaultDrop && allowDrop ? "drop" : null);
  }, [open, selected, defaultDrop, allowDrop]);

  const targets = editor?.selectedTargets ?? [];
  const pending = pick === "drop" ? !!editor?.dropping : !!editor?.applying;
  const error =
    pick === "drop"
      ? transactionError(editor?.dropError ?? null)?.message
      : editor?.applyError
        ? userMessage(editor.applyError)
        : editor?.moveErrors[0]?.message;

  const describePick = (): { label: string; release: string } => {
    if (!state || !editor || !player || pick === null) return { label: "Pick a destination", release: "" };
    if (pick === "drop") return { label: `Slide to drop ${player.name} on ESPN`, release: "Release to drop" };
    const holders = occupants(state, editor.staged, pick);
    const seatOpen = holders.length < slotCapacity(state, pick);
    const partner = seatOpen ? null : swapPartner(state, editor.staged, player.player_id, pick);
    return partner
      ? { label: `Slide to swap with ${partner.name}`, release: "Release to swap" }
      : { label: `Slide to move to ${slotName(pick)}`, release: "Release to move" };
  };
  const { label, release } = describePick();

  const confirm = () => {
    if (!editor || !player || pick === null) return;
    void (async () => {
      const outcome =
        pick === "drop" ? await editor.dropPlayer(player.player_id) : await editor.applyMove(player.player_id, pick);
      // A refusal stays open with the reason; the board itself changed on "stale".
      if (outcome !== "refused") onOpenChange(false);
    })();
  };

  return (
    <Drawer open={open} onOpenChange={(next) => !pending && onOpenChange(next)} setBackgroundColorOnScale={false}>
      <DrawerContent className="max-h-[85vh] supports-[height:100dvh]:max-h-[85dvh] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DrawerHeader className="px-4 pb-3 pt-1 text-left">
          <DrawerTitle className="text-sm">Move {player?.name ?? "player"}</DrawerTitle>
          <DrawerDescription className="text-xs">
            {player && editor
              ? `${slotName(editor.assignment.get(player.player_id) ?? player.lineup_slot_id)} · ${gameLabel(player)}`
              : "Pick where he goes."}
          </DrawerDescription>
        </DrawerHeader>

        <div role="radiogroup" aria-label="Destination" className="overflow-y-auto border-t border-border">
          {editor && state && player && current ? (
            targets.length === 0 && !allowDrop ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No slot he can move to right now.
              </p>
            ) : (
              <ul className="divide-y divide-border/50">
                {targets.map((slot) => {
                  const holders = occupants(state, editor.staged, slot);
                  const seatOpen = holders.length < slotCapacity(state, slot);
                  const partner = seatOpen ? null : swapPartner(state, editor.staged, player.player_id, slot);
                  const checked = pick === slot;
                  return (
                    <li key={slot}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        disabled={pending}
                        onClick={() => setPick(checked ? null : slot)}
                        className={cn(
                          "flex min-h-[48px] w-full items-center gap-3 border-l-2 border-l-transparent px-4 text-left transition-colors hover:bg-muted/40",
                          checked && "border-l-primary bg-primary/10"
                        )}
                      >
                        <Badge
                          variant={slot === 13 ? "outline" : slot === 12 ? "secondary" : "default"}
                          className="w-11 justify-center font-mono"
                        >
                          {slotName(slot)}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {seatOpen ? (
                            <span className="text-muted-foreground">Open seat</span>
                          ) : partner ? (
                            <>
                              Swap with <span className="font-medium">{partner.name}</span>
                              <span className="text-xs text-muted-foreground"> · {gameLabel(partner)}</span>
                            </>
                          ) : (
                            holders.map((h) => h.name).join(", ")
                          )}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 font-mono text-[10px] uppercase",
                            checked ? "text-primary" : "text-status-win"
                          )}
                        >
                          {checked ? "picked" : seatOpen ? "move" : "swap"}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {allowDrop && (
                  <li>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={pick === "drop"}
                      disabled={pending}
                      onClick={() => setPick(pick === "drop" ? null : "drop")}
                      className={cn(
                        "flex min-h-[48px] w-full items-center gap-3 border-l-2 border-l-transparent px-4 text-left transition-colors hover:bg-status-loss/10",
                        pick === "drop" && "border-l-status-loss bg-status-loss/10"
                      )}
                    >
                      <span className="flex w-11 shrink-0 justify-center">
                        <UserMinus className="h-4 w-4 text-status-loss" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        Drop him
                        <span className="text-xs text-muted-foreground"> · to waivers or free agency</span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] uppercase text-status-loss">
                        {pick === "drop" ? "picked" : "drop"}
                      </span>
                    </button>
                  </li>
                )}
              </ul>
            )
          ) : null}
        </div>

        {editor && player && current && (
          <div className="flex flex-col gap-2 border-t border-border px-4 pt-3">
            {error && (
              <p className="flex items-start gap-1.5 text-xs text-status-loss" role="alert">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}
            <SlideToConfirm
              label={label}
              releaseLabel={release}
              variant={pick === "drop" ? "destructive" : "default"}
              onConfirm={confirm}
              pending={pending}
              disabled={pick === null || !editor.canWrite}
            />
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
