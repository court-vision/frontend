"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DraftSession } from "@/types/draft";

/**
 * Asked before running a mock to the end, and only when a pick of the caller's
 * is still to come.
 *
 * "Sim to my pick" never drafts for you; "sim to end" does, because the draft
 * cannot otherwise finish. That is a real difference and worth one dialog — the
 * autopicker takes the best available by ADP with no roster-need model, so the
 * seat it plays for you is exactly the seat you would have played better. The
 * point of the copy is to make stopping at your pick the obvious alternative,
 * not to make the button harder to press.
 */
interface SimulateToEndDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: DraftSession;
  onConfirm: () => void;
  isRunning: boolean;
}

export function SimulateToEndDialog({
  open,
  onOpenChange,
  session,
  onConfirm,
  isRunning,
}: SimulateToEndDialogProps) {
  const remaining =
    session.total_picks !== null && session.total_picks !== undefined
      ? session.total_picks - session.pick_count
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Simulate to the end?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                The autopicker plays{" "}
                {remaining !== null ? `all ${remaining} remaining picks` : "every remaining pick"} —
                including your seat at slot {session.my_slot}, starting with pick{" "}
                {session.my_next_pick}. Those are recorded as your picks and the room closes as
                completed.
              </p>
              <p className="text-muted-foreground">
                It drafts by ADP with no roster-need model, so it will not pick as well as you
                would. Stop at your pick instead if you want the board to make the case. You can
                undo picks one at a time afterwards.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isRunning}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isRunning}>
            {isRunning ? "Simulating…" : "Simulate to the end"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
