"use client";

import { useMemo } from "react";
import { Zap, AlertCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useFocusPlayer } from "@/hooks/useFocusPlayer";
import { useBreakoutStreamersQuery } from "@/hooks/useBreakoutStreamers";
import { useStreamersQuery } from "@/hooks/useStreamers";
import { useTeams } from "@/app/context/TeamsContext";
import { Skeleton } from "@/components/ui/skeleton";
import type { BreakoutCandidateResp } from "@/types/breakout";

/** Unified streamer item for the panel list */
interface UnifiedStreamer {
  playerId: number;
  name: string;
  team: string;
  avgFpts: number;
  score: number;
  tag: "OPP" | "B2B" | null;
  breakoutContext?: BreakoutCandidateResp;
}

function StreamerCard({
  streamer,
  isActive,
  onFocus,
}: {
  streamer: UnifiedStreamer;
  isActive: boolean;
  onFocus: () => void;
}) {
  return (
    <button
      className={cn(
        "flex items-start gap-2 w-full px-3 py-2 text-left transition-colors border-b border-border/30",
        "hover:bg-muted/50",
        isActive && "bg-primary/10"
      )}
      onClick={onFocus}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium truncate">{streamer.name}</span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            {streamer.team}
          </span>
          {streamer.tag && (
            <span
              className={cn(
                "text-[9px] font-mono font-bold px-1 rounded",
                streamer.tag === "OPP"
                  ? "bg-amber-500/15 text-amber-500"
                  : "bg-blue-500/15 text-blue-400"
              )}
            >
              {streamer.tag}
            </span>
          )}
        </div>
        {streamer.breakoutContext && (
          <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
            For:{" "}
            <span className="text-amber-500">
              {streamer.breakoutContext.injured_player.name}
            </span>{" "}
            <span className="text-muted-foreground/60">
              ({streamer.breakoutContext.injured_player.status})
            </span>
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-xs font-bold text-primary tabular-nums">
          {streamer.avgFpts.toFixed(1)}
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">
          {streamer.score.toFixed(0)} pts
        </div>
      </div>
    </button>
  );
}

export function StreamersPanel() {
  const { focusedPlayerId } = useTerminalStore();
  const focusPlayer = useFocusPlayer();
  const { selectedTeam, teams } = useTeams();

  const selectedTeamData = useMemo(
    () => teams.find((t) => t.team_id === selectedTeam),
    [teams, selectedTeam]
  );
  const leagueInfo = selectedTeamData?.league_info || null;

  const { data: breakoutData, isLoading: breakoutLoading, error: breakoutError } =
    useBreakoutStreamersQuery(30);
  const { data: streamerData, isLoading: streamerLoading } =
    useStreamersQuery(leagueInfo, selectedTeam, {
      faCount: 50,
      excludeInjured: true,
      mode: "daily",
    });

  const isLoading = breakoutLoading || (!!leagueInfo && streamerLoading);

  // Merge breakout candidates and regular streamers into a unified list
  const unified = useMemo(() => {
    const seen = new Set<number>();
    const items: UnifiedStreamer[] = [];

    // Build breakout lookup
    const breakoutMap = new Map<number, BreakoutCandidateResp>();
    for (const c of breakoutData?.candidates ?? []) {
      breakoutMap.set(c.beneficiary.player_id, c);
    }

    // Add regular streamers (they have the authoritative streamer_score)
    if (streamerData?.streamers) {
      for (const s of streamerData.streamers) {
        seen.add(s.player_id);
        items.push({
          playerId: s.nba_player_id ?? s.player_id,
          name: s.name,
          team: s.team,
          avgFpts: s.avg_points_last_n ?? s.avg_points_season,
          score: s.streamer_score,
          tag: breakoutMap.has(s.player_id) ? "OPP" : s.has_b2b ? "B2B" : null,
          breakoutContext: breakoutMap.get(s.player_id),
        });
      }
    }

    // Add breakout candidates not already in the streamers list
    // (these are players who may not be free agents but are worth knowing about)
    for (const c of breakoutData?.candidates ?? []) {
      if (seen.has(c.beneficiary.player_id)) continue;
      seen.add(c.beneficiary.player_id);
      items.push({
        playerId: c.beneficiary.nba_player_id ?? c.beneficiary.player_id,
        name: c.beneficiary.name,
        team: c.beneficiary.team,
        avgFpts: c.beneficiary.avg_fpts,
        score: c.signals.breakout_score,
        tag: "OPP",
        breakoutContext: c,
      });
    }

    // Sort by score descending
    items.sort((a, b) => b.score - a.score);
    return items;
  }, [breakoutData, streamerData]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-2 gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (breakoutError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertCircle className="h-6 w-6 text-destructive/50 mb-2" />
        <p className="text-sm text-destructive">Failed to load streamers</p>
      </div>
    );
  }

  if (unified.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Zap className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No streamers available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {unified.map((streamer) => (
          <StreamerCard
            key={streamer.playerId}
            streamer={streamer}
            isActive={streamer.playerId === focusedPlayerId}
            onFocus={() => focusPlayer(streamer.playerId)}
          />
        ))}
      </div>
    </div>
  );
}
