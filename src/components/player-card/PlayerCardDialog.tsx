"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";

import { PlayerCard, type PlayerCardProps } from "./PlayerCard";

interface PlayerCardDialogProps extends PlayerCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The player card in a dialog: one look everywhere a row opens a player
 * (rankings, roster, streamers, matchup). The card owns its padding and its
 * accessible title; the dialog primitive only supplies the surface and the
 * close control, nudged to sit inside the card's header padding.
 */
export function PlayerCardDialog({ open, onOpenChange, ...card }: PlayerCardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[960px] gap-0 p-0 max-sm:p-0 [&>button]:right-5 [&>button]:top-5 sm:[&>button]:right-7 sm:[&>button]:top-6">
        <PlayerCard {...card} />
      </DialogContent>
    </Dialog>
  );
}
