"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Info, Loader2, Lock, Send } from "lucide-react";

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
import { HintPopover } from "@/components/ui/hint";
import { QueryErrorState } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerHeadshot } from "@/components/terminal/shared";
import { useTeamLineupQuery } from "@/hooks/useLineupEditor";
import { useRosterTransactionMutation } from "@/hooks/useRosterTransaction";
import { getInjuryBadge } from "@/lib/injury-badge";
import { lockLabel, slotName } from "@/lib/lineup-editor";
import { formatPositions } from "@/lib/positions";
import {
  addBlockedReason,
  canAddWithoutDrop,
  dropBlockedReason,
  dropCandidates,
  transactionBody,
  transactionError,
} from "@/lib/roster-transaction";
import { cn } from "@/lib/utils";
import type { StreamerPlayer } from "@/types/streamer";

import { WaiversBadge } from "./StreamerBadges";

interface AddStreamerDialogProps {
  /** The streamer to add, or null for drop-only mode: release a roster player, add nobody. */
  player: StreamerPlayer | null;
  teamId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Rendered between the drop list and the footer. The seam for the follow-up
   * category-impact chart ("what this add/drop does to your week"); nothing
   * is passed today.
   */
  impact?: ReactNode;
}

function slotVariant(slotId: number): "default" | "secondary" | "outline" {
  if (slotId === 13) return "outline";
  if (slotId === 12) return "secondary";
  return "default";
}

/**
 * Confirm step for picking a streamer up on ESPN — choose who (if anyone) to
 * drop, then send — or, with no streamer, for dropping someone outright. The
 * board comes from the lineup editor's query (so it is shared with
 * /your-teams and re-polls while writable); the rules live in
 * `lib/roster-transaction`. The dialog only reads them.
 */
export function AddStreamerDialog({
  player,
  teamId,
  open,
  onOpenChange,
  impact,
}: AddStreamerDialogProps) {
  const lineup = useTeamLineupQuery(teamId, "espn");
  const mutation = useRosterTransactionMutation(teamId);
  const state = lineup.data ?? null;

  // The drop choice is remembered for the player it was made for, so opening
  // the dialog for someone else starts clean. `undefined` = nothing picked yet.
  const [choice, setChoice] = useState<{ forPlayer: number | null; dropId: number | null } | null>(null);
  const playerId = player?.player_id ?? null;
  const dropOnly = player === null;
  const picked = choice && choice.forPlayer === playerId ? choice.dropId : undefined;
  const { reset } = mutation;
  useEffect(() => {
    reset();
  }, [playerId, open, reset]);

  const hasSeat = !!state && canAddWithoutDrop(state);
  // Nothing picked and a seat is open: "don't drop anyone" is the default for
  // an add. A straight drop has no default — someone must be chosen.
  const dropId: number | null | undefined =
    picked !== undefined ? picked : hasSeat && !dropOnly ? null : undefined;
  const blocked = player
    ? addBlockedReason({ player, state, provider: "espn" })
    : dropBlockedReason({ state, provider: "espn" });
  const candidates = state ? dropCandidates(state) : [];
  const inlineError = transactionError(mutation.error);
  const pending = mutation.isPending;
  const body = state && dropId !== undefined ? transactionBody({ player, dropId, state }) : null;
  const canSubmit = !!body && !blocked && !pending;

  const submit = () => {
    if (!body) return;
    mutation.mutate(body, { onSuccess: () => onOpenChange(false) });
  };

  const positions = player ? formatPositions(player.valid_positions) : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-w-md gap-3 p-0 max-sm:p-0">
        <DialogHeader className="px-5 pr-10 pt-5">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>{player ? `Add ${player.name} on ESPN` : "Drop a player on ESPN"}</span>
            {player?.acquisition_status === "waivers" && <WaiversBadge until={player.waivers_until} />}
          </DialogTitle>
          <DialogDescription>
            {player && (
              <span className="block text-foreground/80">
                {player.team}
                {positions ? ` · ${positions}` : ""}
              </span>
            )}
            {dropOnly
              ? "This releases the player on ESPN now — he goes to waivers or the free-agent pool under your league's rules."
              : "This sends the transaction to ESPN now. Players lock at their game's tip-off."}
          </DialogDescription>
        </DialogHeader>

        {blocked && (
          <div className="flex items-start gap-2 border-y border-status-projected/30 bg-status-projected/10 px-5 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-projected" />
            <span>{blocked}</span>
          </div>
        )}

        {lineup.isPending ? (
          <div className="flex flex-col gap-2 px-5" aria-busy="true" aria-label="Loading your roster">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : lineup.isError ? (
          <QueryErrorState
            error={lineup.error}
            onRetry={() => void lineup.refetch()}
            isRetrying={lineup.isFetching}
            compact
          />
        ) : !state ? (
          <p className="px-5 py-4 text-center text-sm text-muted-foreground">
            ESPN has no board for this team today.
          </p>
        ) : (
          <div
            role="radiogroup"
            aria-label="Player to drop"
            className="max-h-[50vh] overflow-y-auto border-y border-border"
          >
            {!dropOnly && (
              <ChoiceRow
                checked={dropId === null}
                disabled={!hasSeat || pending}
                onSelect={() => setChoice({ forPlayer: playerId, dropId: null })}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">Don&apos;t drop anyone</span>
                {hasSeat ? (
                  <span className="shrink-0 text-xs text-muted-foreground">Open seat</span>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Roster is full — pick someone to drop
                  </span>
                )}
              </ChoiceRow>
            )}
            {candidates.map(({ player: p, locked }) => {
              const lock = lockLabel(p);
              return (
                <ChoiceRow
                  key={p.player_id}
                  checked={dropId === p.player_id}
                  disabled={locked || pending}
                  onSelect={() => setChoice({ forPlayer: playerId, dropId: p.player_id })}
                >
                  <Badge variant={slotVariant(p.lineup_slot_id)} className="w-11 shrink-0 justify-center font-mono">
                    {slotName(p.lineup_slot_id)}
                  </Badge>
                  <PlayerHeadshot playerId={p.nba_player_id} name={p.name} size="xs" />
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="truncate text-sm">{p.name}</span>
                    {getInjuryBadge(p.injury_status)}
                    {locked && (
                      <HintPopover content={lock ?? "Locked"}>
                        <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-label={lock ?? "Locked"} />
                      </HintPopover>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {p.avg_points.toFixed(1)}
                  </span>
                </ChoiceRow>
              );
            })}
          </div>
        )}

        {impact}

        {inlineError && (
          <p className="flex items-start gap-1.5 px-5 text-xs text-status-loss" role="alert">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {inlineError.message}
          </p>
        )}

        <DialogFooter className="gap-2 px-5 pb-5 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={submit} disabled={!canSubmit} className="gap-1.5">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {pending ? "Sending…" : dropOnly ? "Drop on ESPN" : "Add on ESPN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One radio-like row: a 44 px button that reports its state to assistive tech. */
function ChoiceRow({
  checked,
  disabled,
  onSelect,
  children,
}: {
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex min-h-[44px] w-full items-center gap-3 border-b border-border/50 px-4 text-left transition-colors last:border-b-0",
        "hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
        checked && "bg-primary/10"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          checked ? "border-primary" : "border-muted-foreground/50"
        )}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      {children}
    </button>
  );
}
