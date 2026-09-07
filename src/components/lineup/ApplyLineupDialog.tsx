"use client";

import { AlertTriangle, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { userMessage } from "@/lib/api-error";
import { slotName } from "@/lib/lineup-editor";
import { useLineupEditor } from "./LineupEditorProvider";

/** Confirm step before the staged moves are sent to ESPN. */
export function ApplyLineupDialog() {
  const editor = useLineupEditor();
  if (!editor || !editor.state) return null;

  const { confirmOpen, setConfirmOpen, moves, apply, applying, applyError, moveErrors, playerById } =
    editor;
  const n = moves.length;

  return (
    <Dialog open={confirmOpen} onOpenChange={(open) => !applying && setConfirmOpen(open)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apply on ESPN</DialogTitle>
          <DialogDescription>
            This sends {n} move{n === 1 ? "" : "s"} to ESPN now. Players lock at their game&apos;s
            tip-off.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-[40vh] space-y-1.5 overflow-y-auto text-sm">
          {moves.map((m) => (
            <li key={m.player_id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">
                {playerById.get(m.player_id)?.name ?? `Player ${m.player_id}`}
              </span>
              <Badge variant="neutral" className="font-mono">
                {slotName(m.from_slot_id)}
              </Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant={m.to_slot_id === 12 ? "secondary" : "default"} className="font-mono">
                {slotName(m.to_slot_id)}
              </Badge>
            </li>
          ))}
        </ul>

        {applyError && moveErrors.length === 0 && (
          <p className="flex items-start gap-1.5 text-xs text-status-loss">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {userMessage(applyError)}
          </p>
        )}
        {moveErrors.length > 0 && (
          <ul className="space-y-0.5">
            {moveErrors.map((e, i) => (
              <li key={`${e.code}-${i}`} className="flex items-start gap-1.5 text-xs text-status-loss">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {e.player_id != null && playerById.get(e.player_id) && (
                    <span className="font-medium">{playerById.get(e.player_id)!.name}: </span>
                  )}
                  {e.message}
                </span>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={applying}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={() => void apply()} disabled={applying || n === 0} className="gap-1.5">
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {applying ? "Sending…" : "Apply on ESPN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
