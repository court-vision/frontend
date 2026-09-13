"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlideToConfirm } from "@/components/ui/slide-to-confirm";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
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
    <ResponsiveDialog open={open} onOpenChange={(next) => !next && !dropping && cancelDrop()}>
      <ResponsiveDialogContent className="max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Drop {player?.name ?? "player"} on ESPN?</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            This releases him now &mdash; he goes to waivers or the free-agent pool under your
            league&apos;s rules, and Court Vision cannot undo it.
            {staged > 0 && (
              <>
                {" "}
                Your {staged} staged move{staged === 1 ? "" : "s"} will be cleared.
              </>
            )}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

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

        <ResponsiveDialogFooter className="flex-col-reverse gap-2 sm:flex-col-reverse sm:space-x-0">
          <ResponsiveDialogClose asChild>
            <Button type="button" variant="ghost" disabled={dropping}>
              Cancel
            </Button>
          </ResponsiveDialogClose>
          <SlideToConfirm
            label="Slide to drop on ESPN"
            releaseLabel="Release to drop"
            variant="destructive"
            onConfirm={() => void confirmDrop()}
            pending={dropping}
            disabled={!player}
          />
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
