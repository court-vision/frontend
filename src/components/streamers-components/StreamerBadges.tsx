"use client";

import { Badge } from "@/components/ui/badge";
import { HintPopover } from "@/components/ui/hint";
import { BASELINE_VALUE_TITLE } from "@/lib/category-format";
import { cn } from "@/lib/utils";
import type { BreakoutCandidateResp } from "@/types/breakout";

import { POSITIONS } from "./StreamerFilterControls";

/** "OPP" badge with the injury-opportunity summary as a hover/tap hint. */
export function OppBadge({
  context,
  className,
}: {
  context: BreakoutCandidateResp;
  className?: string;
}) {
  const { injured_player, signals } = context;
  return (
    <HintPopover
      contentClassName="max-w-[240px] space-y-1"
      content={
        <>
          <p className="font-semibold text-xs">
            {injured_player.name} is {injured_player.status.toLowerCase()}
          </p>
          <p className="text-xs text-primary-foreground/70">
            +{signals.projected_min_boost.toFixed(1)} min projected boost
            {signals.opp_fpts_avg !== null
              ? ` · ${signals.opp_fpts_avg.toFixed(1)} fpts in ${signals.opp_game_count} opp games`
              : ""}
          </p>
        </>
      }
    >
      <Badge variant="breakout" className={cn("text-[11px] cursor-help", className)}>
        OPP
      </Badge>
    </HintPopover>
  );
}

/** Marks an average that comes from last season's per-game line. */
export function PriorSeasonBadge({ className }: { className?: string }) {
  return (
    <HintPopover
      contentClassName="max-w-[220px]"
      content={<p className="text-xs">{BASELINE_VALUE_TITLE}</p>}
    >
      <Badge
        variant="neutral"
        className={cn("px-1 py-0 text-[9px] font-medium cursor-help", className)}
      >
        prior season
      </Badge>
    </HintPopover>
  );
}

/** Up to four of the player's standard positions. */
export function PositionBadges({
  positions,
  className,
}: {
  positions: string[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {positions
        .filter((pos) => (POSITIONS as readonly string[]).includes(pos))
        .slice(0, 4)
        .map((pos) => (
          <Badge key={pos} variant="outline" className="text-[11px] px-1.5 py-0">
            {pos}
          </Badge>
        ))}
    </div>
  );
}
