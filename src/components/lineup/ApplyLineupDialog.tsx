"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideToConfirm } from "@/components/ui/slide-to-confirm";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
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
    <ResponsiveDialog open={confirmOpen} onOpenChange={(open) => !applying && setConfirmOpen(open)}>
      <ResponsiveDialogContent className="max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Apply on ESPN</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            This sends {n} move{n === 1 ? "" : "s"} to ESPN now. Players lock at their game&apos;s
            tip-off.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

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

        {/* Column-reverse in both modes: the slider on top, Cancel under it. */}
        <ResponsiveDialogFooter className="flex-col-reverse gap-2 sm:flex-col-reverse sm:space-x-0">
          <ResponsiveDialogClose asChild>
            <Button type="button" variant="ghost" disabled={applying}>
              Cancel
            </Button>
          </ResponsiveDialogClose>
          <SlideToConfirm
            label="Slide to apply on ESPN"
            releaseLabel="Release to apply"
            onConfirm={() => void apply()}
            pending={applying}
            disabled={n === 0}
          />
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
