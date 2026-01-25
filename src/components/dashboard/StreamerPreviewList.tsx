"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useStreamersQuery } from "@/hooks/useStreamers";
import { useTeams } from "@/app/context/TeamsContext";
import type { StreamerPlayer } from "@/types/streamer";
import type { LeagueInfo } from "@/types/team";

interface StreamerPreviewListProps {
  limit?: number;
}

export function StreamerPreviewList({ limit = 5 }: StreamerPreviewListProps) {
  const { selectedTeam, teams } = useTeams();

  // Find the selected team's league info
  const selectedTeamData = teams?.find(
    (t: { team_id: number; league_info: LeagueInfo }) => t.team_id === selectedTeam
  );
  const leagueInfo = selectedTeamData?.league_info || null;

  // Fetch the same data as StreamerDisplay (75 players) to ensure consistent
  // rankings and share the React Query cache when navigating to /streamers
  const { data, isLoading, error } = useStreamersQuery(leagueInfo, selectedTeam, {
    faCount: 75,
    excludeInjured: true,
    avgDays: 7,
  });

  if (isLoading) {
    return <StreamerPreviewSkeleton count={limit} />;
  }

  if (error || !data?.streamers) {
    return (
      <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
        {selectedTeam ? "Unable to load streamers" : "Select a team to view streamers"}
      </div>
    );
  }

  const streamers = data.streamers.slice(0, limit);

  if (streamers.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
        No streamers available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {streamers.map((streamer, index) => (
        <StreamerPreviewItem
          key={streamer.player_id}
          streamer={streamer}
          rank={index + 1}
        />
      ))}
    </div>
  );
}

function StreamerPreviewItem({
  streamer,
  rank,
}: {
  streamer: StreamerPlayer;
  rank: number;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <span className="font-mono text-xs text-muted-foreground w-5">
        #{rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{streamer.name}</p>
        <p className="text-xs text-muted-foreground">
          {streamer.team} · {streamer.valid_positions.join("/")}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {streamer.has_b2b && (
          <Badge variant="projected" className="text-[10px] px-1.5">
            B2B
          </Badge>
        )}
        <div className="text-right">
          <p className="font-mono text-sm font-medium tabular-nums">
            {(streamer.avg_points_last_n ?? streamer.avg_points_season).toFixed(1)}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">
            {streamer.games_remaining}g left
          </p>
        </div>
      </div>
    </div>
  );
}

function StreamerPreviewSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="h-4 w-5" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}
