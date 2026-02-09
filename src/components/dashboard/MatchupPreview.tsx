"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMatchupQuery } from "@/hooks/useMatchup";
import { useUIStore } from "@/stores/useUIStore";
import type { MatchupData } from "@/types/matchup";

export function MatchupPreview() {
  const { selectedTeam } = useUIStore();
  const { data: matchup, isLoading, error } = useMatchupQuery(selectedTeam);

  if (isLoading) {
    return <MatchupPreviewSkeleton />;
  }

  if (error || !matchup) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        {selectedTeam ? "Unable to load matchup data" : "Select a team to view matchup"}
      </div>
    );
  }

  return <MatchupPreviewContent matchup={matchup} />;
}

function MatchupPreviewContent({ matchup }: { matchup: MatchupData }) {
  const yourScore = matchup.your_team.current_score;
  const opponentScore = matchup.opponent_team.current_score;
  const scoreDiff = yourScore - opponentScore;
  const isWinning = scoreDiff > 0;
  const isTied = scoreDiff === 0;

  const yourProjected = matchup.your_team.projected_score;
  const opponentProjected = matchup.opponent_team.projected_score;
  const totalProjected = yourProjected + opponentProjected;
  const winProbability = totalProjected > 0
    ? Math.round((yourProjected / totalProjected) * 100)
    : 50;

  return (
    <div className="space-y-4">
      {/* Score Display */}
      <div className="flex items-center justify-between">
        {/* Your Team */}
        <div className="flex-1">
          <p className="text-xs text-muted-foreground truncate max-w-[120px]">
            {matchup.your_team.team_name}
          </p>
          <p className="font-mono text-3xl font-bold tabular-nums">
            {yourScore}
          </p>
        </div>

        {/* VS / Status */}
        <div className="px-4 flex flex-col items-center">
          <Badge variant={isTied ? "neutral" : isWinning ? "win" : "loss"}>
            {isTied ? "TIED" : isWinning ? "LEADING" : "TRAILING"}
          </Badge>
          <span className="text-lg font-bold text-muted-foreground my-1">VS</span>
          <p className="font-mono text-xs text-muted-foreground">
            {scoreDiff > 0 ? "+" : ""}{scoreDiff}
          </p>
        </div>

        {/* Opponent */}
        <div className="flex-1 text-right">
          <p className="text-xs text-muted-foreground truncate max-w-[120px] ml-auto">
            {matchup.opponent_team.team_name}
          </p>
          <p className="font-mono text-3xl font-bold tabular-nums text-muted-foreground">
            {opponentScore}
          </p>
        </div>
      </div>

      {/* Win Probability Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Proj: {yourProjected.toFixed(1)}</span>
          <span>Proj: {opponentProjected.toFixed(1)}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${winProbability}%` }}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          <span className="font-mono font-medium">{winProbability}%</span> win probability
        </p>
      </div>
    </div>
  );
}

function MatchupPreviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
        <div className="px-4 flex flex-col items-center space-y-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-8" />
        </div>
        <div className="flex-1 space-y-2 flex flex-col items-end">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-3 w-24 mx-auto" />
      </div>
    </div>
  );
}
