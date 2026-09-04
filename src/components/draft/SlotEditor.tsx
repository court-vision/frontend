"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DraftSession } from "@/types/draft";

/**
 * Confirm or correct which seat in the pick order is yours.
 *
 * The room asks for this at create time, but a session can reach the room
 * without one — the field is skippable, and a league whose settings have not
 * synced has no pick order to choose a seat from. Everything that depends on
 * the slot then goes quiet: whose turn it is, and pricing keepers into the
 * picks their rounds cost. So it has to be settable afterwards too, which the
 * PATCH route has always supported ("confirming or correcting `my_slot`").
 *
 * Changing it mid-draft is a real correction, not a mistake to guard against:
 * the backend reprices recorded keepers onto their new numbers, or refuses the
 * change if that would collide.
 */
interface SlotEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: DraftSession;
  onSave: (slot: number | null) => void;
  isSaving: boolean;
}

export function SlotEditor({ open, onOpenChange, session, onSave, isSaving }: SlotEditorProps) {
  const leagueSize = session.league_size ?? 0;
  const [slot, setSlot] = useState<string>(session.my_slot ? String(session.my_slot) : "");

  // Reopening starts from what the session holds, not a stale edit.
  useEffect(() => {
    if (open) setSlot(session.my_slot ? String(session.my_slot) : "");
  }, [open, session.my_slot]);

  // A seat is a whole number from 1, whether or not we know the upper bound —
  // the free-text fallback has no form to enforce its `min`, and the PATCH
  // schema rejects 0, negatives and fractions anyway. Catching it here turns
  // an avoidable 422 into a disabled button that says why.
  const parsed = slot === "" ? null : Number(slot);
  const isSeatNumber = parsed !== null && Number.isInteger(parsed) && parsed >= 1;
  const outOfRange = isSeatNumber && leagueSize > 0 && (parsed as number) > leagueSize;
  const invalid = parsed !== null && (!isSeatNumber || outOfRange);
  const unchanged = parsed === (session.my_slot ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Your slot</DialogTitle>
          <DialogDescription className="text-xs">
            Which seat in the draft order is yours. It is what tells the room whose turn it is,
            and what a keeper&apos;s round costs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {leagueSize > 0 ? (
            <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: leagueSize }, (_, i) => i + 1).map((seat) => (
                <button
                  key={seat}
                  onClick={() => setSlot(String(seat))}
                  aria-pressed={parsed === seat}
                  className={cn(
                    "rounded border py-1.5 font-mono text-xs transition-colors",
                    parsed === seat
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/60 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {seat}
                </button>
              ))}
            </div>
          ) : (
            <>
              <Input
                type="number"
                min={1}
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                placeholder="e.g. 3"
                aria-label="Your slot"
                className="h-8 text-xs"
                autoFocus
              />
              <p className="text-[10px] text-amber-500">
                This draft has no pick order yet, so there are no seats to choose from and the
                room cannot work out whose turn it is. Sync the league from Manage Teams to get
                one.
              </p>
            </>
          )}

          <p className="text-[10px] text-muted-foreground">
            {leagueSize > 0
              ? `Seat 1 picks first in round one. ESPN's pick order uses its own team ids, so we cannot tell which seat is yours.`
              : "The slot is recorded either way, and starts working once the draft has a pick order."}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {session.my_slot !== null && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isSaving}
              onClick={() => onSave(null)}
              className="h-8 text-xs text-muted-foreground"
            >
              Clear
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={isSaving || invalid || unchanged || parsed === null}
            onClick={() => onSave(parsed)}
          >
            {isSaving
              ? "Saving..."
              : invalid
                ? leagueSize > 0
                  ? `Seats 1–${leagueSize}`
                  : "Whole numbers from 1"
                : "Set slot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
