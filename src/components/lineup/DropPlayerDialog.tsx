"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlayerHeadshot } from "@/components/terminal/shared";
import { getInjuryBadge } from "@/lib/injury-badge";
import { slotName } from "@/lib/lineup-editor";
import { transactionError } from "@/lib/roster-transaction";
import { useLineupEditor } from "./LineupEditorProvider";

/**
 * Confirm step before a player is released on ESPN from the board's Drop row.
 * A drop is its own transaction, so it is never staged: the confirm sends it,
 * and the re-read board that comes back clears any staged moves.
 */
export function DropPlayerDialog() {
  const editor = useLineupEditor();
  const dropTargetId = editor?.dropTargetId ?? null;
  const current = dropTargetId != null ? editor?.playerById.get(dropTargetId) : undefined;
  // After a successful drop the player leaves the board before the dialog has
  // finished closing; keep showing the one the confirm was about.
  const [player, setPlayer] = useState(current);
  useEffect(() => {
    if (current) setPlayer(current);
  }, [current]);
  if (!editor || !editor.state) return null;

  const { cancelDrop, confirmDrop, dropping, dropError, moves } = editor;
  const open = dropTargetId != null;
  const inlineError = transactionError(dropError);
  const staged = moves.length;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !dropping && cancelDrop()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Drop {player?.name ?? "player"} on ESPN?</DialogTitle>
          <DialogDescription>
            This releases him now &mdash; he goes to waivers or the free-agent pool under your
            league&apos;s rules, and Court Vision cannot undo it.
            {staged > 0 && (
              <>
                {" "}
                Your {staged} staged move{staged === 1 ? "" : "s"} will be cleared.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {player && (
          <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
            <Badge
              variant={player.lineup_slot_id === 12 ? "secondary" : player.lineup_slot_id === 13 ? "outline" : "default"}
              className="w-11 shrink-0 justify-center font-mono"
            >
              {slotName(player.lineup_slot_id)}
            </Badge>
            <PlayerHeadshot playerId={player.nba_player_id} name={player.name} size="xs" />
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="truncate text-sm font-medium">{player.name}</span>
              <span className="text-xs text-muted-foreground">{player.team}</span>
              {getInjuryBadge(player.injury_status)}
            </span>
            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              {player.avg_points.toFixed(1)}
            </span>
          </div>
        )}

        {inlineError && (
          <p className="flex items-start gap-1.5 text-xs text-status-loss" role="alert">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {inlineError.message}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={dropping}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={() => void confirmDrop()}
            disabled={dropping || !player}
            className="gap-1.5 bg-status-loss text-white hover:bg-status-loss/90"
          >
            {dropping ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
            {dropping ? "Sending\u2026" : "Drop on ESPN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
