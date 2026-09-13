"use client";

import { useEffect, useState } from "react";
import { UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { gameLabel, occupants, slotCapacity, slotName, swapPartner } from "@/lib/lineup-editor";
import { useLineupEditor } from "./LineupEditorProvider";

interface LineupTargetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Offer "Drop … on ESPN" under the slots. Only where `DropPlayerDialog` is
   * mounted to take the confirm (the board on Your Teams); the matchup tables
   * mount no drop confirm and leave this off.
   */
  allowDrop?: boolean;
}

/**
 * Phone picker for the selected player's destination: every eligible slot
 * with who would swap out of it, and (where allowed) the drop. Opened by a
 * tap on a player row; swipe down or pick to dismiss.
 */
export function LineupTargetSheet({ open, onOpenChange, allowDrop = false }: LineupTargetSheetProps) {
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

  const targets = editor?.selectedTargets ?? [];

  return (
    <Drawer open={open} onOpenChange={onOpenChange} setBackgroundColorOnScale={false}>
      <DrawerContent className="max-h-[80vh] supports-[height:100dvh]:max-h-[80dvh] pb-[env(safe-area-inset-bottom)]">
        <DrawerHeader className="px-4 pb-3 pt-1 text-left">
          <DrawerTitle className="text-sm">Move {player?.name ?? "player"}</DrawerTitle>
          <DrawerDescription className="text-xs">
            {player && editor
              ? `${slotName(editor.assignment.get(player.player_id) ?? player.lineup_slot_id)} · ${gameLabel(player)}`
              : "Pick the slot to move him to."}
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto border-t border-border">
          {editor && state && player && current ? (
            targets.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No slot he can move to right now.
              </p>
            ) : (
              <ul className="divide-y divide-border/50">
                {targets.map((slot) => {
                  const holders = occupants(state, editor.staged, slot);
                  const seatOpen = holders.length < slotCapacity(state, slot);
                  const partner = seatOpen ? null : swapPartner(state, editor.staged, player.player_id, slot);
                  return (
                    <li key={slot}>
                      <button
                        type="button"
                        className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left hover:bg-muted/40"
                        onClick={() => {
                          editor.stage(player.player_id, slot);
                          onOpenChange(false);
                        }}
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
                        <span className="shrink-0 font-mono text-[10px] uppercase text-status-win">
                          {seatOpen ? "move" : "swap"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
          {allowDrop && editor && player && current && (
            <div className="border-t border-border p-3">
              <button
                type="button"
                onClick={() => {
                  editor.requestDrop();
                  onOpenChange(false);
                }}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-status-loss/30 bg-status-loss/10 text-sm font-medium text-status-loss"
              >
                <UserMinus className="h-4 w-4" />
                Drop {player.name} on ESPN
              </button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
