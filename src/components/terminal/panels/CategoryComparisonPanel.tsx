"use client";

import { Grid3x3 } from "lucide-react";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useLiveMatchupQuery, useMatchupQuery } from "@/hooks/useMatchup";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryComparisonGrid } from "@/components/matchup-components/CategoryComparisonGrid";
import { deriveHeadline } from "@/lib/matchup-headline";
import { winnerBadgeVariant } from "@/lib/category-format";

/**
 * Terminal/dashboard panel: per-category you-vs-opponent grid for the focused
 * team's current matchup (category leagues only).
 */
export function CategoryComparisonPanel() {
  const { focusedTeamId } = useTerminalStore();
  const { data: liveData, isLoading: liveLoading } = useLiveMatchupQuery(focusedTeamId);
  const { data: matchupData, isLoading: matchupLoading } = useMatchupQuery(focusedTeamId);

  if (!focusedTeamId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <Grid3x3 className="h-7 w-7 text-muted-foreground/25" />
        <p className="text-[10px] text-muted-foreground">No team selected</p>
      </div>
    );
  }

  const display = liveData ?? matchupData;

  if (!display) {
    if (liveLoading || matchupLoading) {
      return (
        <div className="flex flex-col h-full p-2 gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="flex-1 w-full" />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="text-[10px] text-muted-foreground">No matchup data</p>
      </div>
    );
  }

  const h = deriveHeadline(display, matchupData);

  if (!h.isCategories || !h.comparison) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-1">
        <Grid3x3 className="h-6 w-6 text-muted-foreground/25" />
        <p className="text-[10px] text-muted-foreground">Category breakdown is for category leagues</p>
        <p className="text-[9px] text-muted-foreground/60">
          This league scores by points — see the Matchup panel.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-border/40 bg-muted/10">
        <Badge variant={winnerBadgeVariant(h.outcome)} className="text-[10px]">
          {h.statusLabel}
        </Badge>
        {h.liveAdjusted && (
          <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-status-win">
            <span className="h-1.5 w-1.5 rounded-full bg-status-win animate-pulse" />
            Live
          </span>
        )}
        <span className="ml-auto text-[9px] font-mono text-muted-foreground/60 truncate">
          vs {display.opponent_team.team_name}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <CategoryComparisonGrid
          variant="compact"
          comparison={h.comparison}
          projected={h.projectedComparison}
          yourName={display.your_team.team_name}
          oppName={display.opponent_team.team_name}
          yourRaw={display.your_team.categories?.raw}
          oppRaw={display.opponent_team.categories?.raw}
        />
      </div>
    </div>
  );
}
