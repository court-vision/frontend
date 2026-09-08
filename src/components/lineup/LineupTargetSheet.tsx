"use client";

import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { gameLabel, occupants, slotCapacity, slotName, swapPartner } from "@/lib/lineup-editor";
import { useLineupEditor } from "./LineupEditorProvider";

interface LineupTargetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Phone picker for the selected player's destination. The matchup tables are
 * not laid out by slot capacity, so an empty seat has no row to tap; this
 * lists every eligible slot with who would swap out of it.
 */
export function LineupTargetSheet({ open, onOpenChange }: LineupTargetSheetProps) {
  const editor = useLineupEditor();
  const state = editor?.state;
  const selected = editor?.selectedPlayerId ?? null;
  const player = selected != null ? editor?.playerById.get(selected) : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-auto max-h-[70vh] overflow-y-auto rounded-t-xl p-0 pb-[env(safe-area-inset-bottom)] supports-[height:100dvh]:max-h-[70dvh]"
      >
        <div className="border-b border-border px-4 pb-3 pt-4">
          <SheetTitle className="text-sm">Move {player?.name ?? "player"}</SheetTitle>
          <SheetDescription className="text-xs">
            {player && editor
              ? `${slotName(editor.assignment.get(player.player_id) ?? player.lineup_slot_id)} · ${gameLabel(player)}`
              : "Pick the slot to move him to."}
          </SheetDescription>
        </div>
        {editor && state && player ? (
          editor.selectedTargets.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No slot he can move to right now.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {editor.selectedTargets.map((slot) => {
                const holders = occupants(state, editor.staged, slot);
                const open = holders.length < slotCapacity(state, slot);
                const partner = open ? null : swapPartner(state, editor.staged, player.player_id, slot);
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
                        {open ? (
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
                        {open ? "move" : "swap"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
