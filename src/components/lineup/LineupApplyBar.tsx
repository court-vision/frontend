"use client";

import { AlertTriangle, Loader2, RotateCcw, Send, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { userMessage } from "@/lib/api-error";
import { moveRole, slotName } from "@/lib/lineup-editor";
import { writeBlockedCopy } from "@/types/lineup-editor";
import type { MoveError } from "@/types/lineup-editor";
import { useLineupEditor } from "./LineupEditorProvider";

const ROLE_CLASS: Record<ReturnType<typeof moveRole>, string> = {
  start: "text-status-win",
  bench: "text-status-loss",
  shift: "text-status-projected",
};

interface LineupApplyBarProps {
  /** Keep the bar on screen with no staged moves (the matchup page has no other "Optimize" button). */
  alwaysShow?: boolean;
  className?: string;
}

/**
 * The staged moves, their validation, and the actions: Optimize today, Reset,
 * Apply on ESPN. Sticks to the bottom of the scroll area on phones (just above
 * the tab bar, which sits below the scroller) and sits inline from `md`.
 */
export function LineupApplyBar({ alwaysShow = false, className }: LineupApplyBarProps) {
  const editor = useLineupEditor();
  if (!editor || !editor.state) return null;

  const {
    state,
    moves,
    validation,
    moveErrors,
    unstage,
    reset,
    loadPlan,
    planStatus,
    plan,
    planError,
    canWrite,
    blockedReason,
    applying,
    setConfirmOpen,
    playerById,
  } = editor;

  const idle = moves.length === 0 && planStatus === "idle";
  if (idle && !alwaysShow) return null;

  const seen = new Set<string>();
  const errors: MoveError[] = [...moveErrors, ...validation].filter((e) => {
    const key = `${e.code}:${e.player_id ?? ""}:${e.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const canApply = canWrite && moves.length > 0 && validation.length === 0 && !applying;

  return (
    <div className={cn("z-20 max-md:sticky max-md:bottom-0 max-md:-mx-4", className)}>
      <div
        className={cn(
          "border border-border bg-card text-card-foreground",
          "rounded-md max-md:rounded-none max-md:border-x-0 max-md:border-b-0",
          "max-md:shadow-[0_-12px_24px_-12px_rgba(0,0,0,0.45)]"
        )}
      >
        <div className="space-y-2 px-3 py-2.5 md:px-4 md:py-3">
          {planStatus === "loading" && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Planning today&apos;s moves…
            </p>
          )}
          {planStatus === "error" && (
            <p className="flex items-start gap-1.5 text-xs text-status-loss">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {userMessage(planError, "Couldn't plan today's moves")}
            </p>
          )}
          {planStatus === "loaded" && plan && (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="flex items-start gap-1.5">
                <Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{plan.summary}</span>
              </p>
              {plan.unfilled.map((u) => (
                <p key={u.player_id} className="pl-5 text-muted-foreground/80">
                  {u.name} stays on the bench —{" "}
                  {u.reason === "slot_holder_locked"
                    ? "the slot he'd take is locked"
                    : "no slot he's eligible for is open"}
                </p>
              ))}
            </div>
          )}
          {idle && (
            <p className="text-xs text-muted-foreground">
              Move a player, or let Court Vision fill today&apos;s open seats.
            </p>
          )}

          {moves.length > 0 && (
            <ul className="space-y-1">
              {moves.map((m) => {
                const role = moveRole(m);
                return (
                  <li key={m.player_id} className="flex min-h-[28px] items-center gap-2 text-sm">
                    <span className={cn("w-10 shrink-0 font-mono text-[10px] uppercase", ROLE_CLASS[role])}>
                      {role}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {playerById.get(m.player_id)?.name ?? `Player ${m.player_id}`}
                      <span className="font-mono text-xs text-muted-foreground">
                        {" "}
                        {slotName(m.from_slot_id)} → {slotName(m.to_slot_id)}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Undo move for ${playerById.get(m.player_id)?.name ?? "player"}`}
                      onClick={() => unstage(m.player_id)}
                      disabled={applying}
                      className="touch-hit inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {errors.length > 0 && (
            <ul className="space-y-0.5" aria-live="polite">
              {errors.map((e, i) => (
                <li key={`${e.code}-${e.player_id ?? "slot"}-${i}`} className="flex items-start gap-1.5 text-xs text-status-loss">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <span className="mr-1 font-mono text-[10px] uppercase opacity-80">{e.code}</span>
                    {e.message}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2 pt-0.5">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs md:h-8"
              onClick={() => void loadPlan()}
              disabled={planStatus === "loading" || applying}
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span className="max-sm:hidden">Optimize today</span>
              <span className="sm:hidden">Optimize</span>
            </Button>
            {!idle && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 text-xs text-muted-foreground md:h-8"
                onClick={reset}
                disabled={applying}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            )}
            <Button
              size="sm"
              className="ml-auto h-9 gap-1.5 text-xs md:h-8"
              onClick={() => setConfirmOpen(true)}
              disabled={!canApply}
            >
              {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Apply on ESPN
              {moves.length > 0 && <span className="font-mono tabular-nums">({moves.length})</span>}
            </Button>
          </div>
          {!canWrite && moves.length > 0 && (
            <p className="text-[11px] text-muted-foreground">{writeBlockedCopy(blockedReason ?? state.write_blocked_reason)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
