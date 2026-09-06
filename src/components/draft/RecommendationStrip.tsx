"use client";

import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DraftRecommendation } from "@/types/draft";

/**
 * The top of the room: who to take next, and why — decomposed.
 *
 * `season_value` is the base the rest are measured from and is shown for
 * context (`in_score: false`); the terms that carry `in_score` sum to `score`.
 * Rendering them is the point of the feature, so a component whose value is 0
 * is still shown rather than hidden — "scarcity contributed nothing" is
 * information.
 *
 * Two actions per card. "Mine" records the pick in this room only. "Draft on
 * ESPN" sends it to ESPN over the draft room's own connection and appears only
 * when the room can do that (`onDraft`); it is enabled only while ESPN says it
 * is your turn, with the reason it is not as its tooltip otherwise.
 */
function componentTone(value: number): string {
  if (value > 0) return "text-green-500";
  if (value < 0) return "text-red-500";
  return "text-muted-foreground/60";
}

function signed(value: number): string {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

interface RecommendationStripProps {
  recommendations: DraftRecommendation[];
  isLoading: boolean;
  onPick?: (playerId: number, name: string) => void;
  isPicking?: boolean;
  onDraft?: (playerId: number, name: string) => void;
  canDraft?: boolean;
  draftDisabledReason?: string | null;
  isDrafting?: boolean;
  /** The NBA player id of a pick sent to ESPN and not yet answered. */
  pendingPlayerId?: number | null;
}

export function RecommendationStrip({
  recommendations,
  isLoading,
  onPick,
  isPicking = false,
  onDraft,
  canDraft = false,
  draftDisabledReason = null,
  isDrafting = false,
  pendingPlayerId = null,
}: RecommendationStripProps) {
  if (isLoading) {
    return (
      <div className="flex gap-2 p-2 overflow-x-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] w-[220px] shrink-0" />
        ))}
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground/50" />
        No recommendations yet — the board needs players it can value.
      </div>
    );
  }

  return (
    <div className="flex gap-2 p-2 overflow-x-auto">
      {recommendations.map((rec, index) => {
        const sending = pendingPlayerId !== null && rec.player_id === pendingPlayerId;
        return (
          <div
            key={rec.player_id}
            className={cn(
              "shrink-0 w-[228px] rounded border bg-card/50 p-2",
              index === 0 ? "border-primary/40 bg-primary/5" : "border-border/50"
            )}
          >
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[10px] font-mono text-muted-foreground">{index + 1}</span>
              <span className="truncate text-sm font-medium">{rec.name}</span>
              {rec.primary_position && (
                <span className="ml-auto shrink-0 text-[10px] font-mono text-muted-foreground">
                  {rec.primary_position}
                </span>
              )}
            </div>

            <div className="mt-0.5 flex items-baseline gap-1.5 font-mono text-[10px] text-muted-foreground">
              <span className="text-sm font-bold tabular-nums text-primary">
                {rec.score.toFixed(1)}
              </span>
              <span>score</span>
              <span className="text-border">·</span>
              <span className="tabular-nums">{rec.value.toFixed(1)}/g</span>
            </div>

            <div className="mt-1.5 space-y-0.5">
              {rec.components.map((component) => (
                <div
                  key={component.key}
                  title={component.detail ?? undefined}
                  className="flex items-center justify-between gap-2 font-mono text-[10px]"
                >
                  <span
                    className={cn(
                      "truncate",
                      component.in_score ? "text-muted-foreground" : "text-muted-foreground/50"
                    )}
                  >
                    {component.label}
                  </span>
                  <span
                    className={cn(
                      "tabular-nums shrink-0",
                      component.in_score ? componentTone(component.value) : "text-muted-foreground/50"
                    )}
                  >
                    {component.in_score ? signed(component.value) : component.value.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>

            {(onPick || onDraft) && (
              <div className="mt-2 flex gap-1">
                {onPick && (
                  <Button
                    size="sm"
                    variant={onDraft ? "ghost" : "outline"}
                    disabled={isPicking}
                    onClick={() => onPick(rec.player_id, rec.name)}
                    title="Record as my pick in this room only"
                    className={cn("h-6 text-[10px]", onDraft ? "flex-1" : "w-full")}
                  >
                    Mine
                  </Button>
                )}
                {onDraft && (
                  <Button
                    size="sm"
                    variant={canDraft && !sending ? "default" : "outline"}
                    disabled={!canDraft || isDrafting}
                    onClick={() => onDraft(rec.player_id, rec.name)}
                    title={
                      canDraft
                        ? "Send this pick to ESPN on your draft room's connection"
                        : (draftDisabledReason ?? undefined)
                    }
                    className="h-6 flex-[2] text-[10px]"
                  >
                    {sending ? "Sending…" : "Draft on ESPN"}
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
