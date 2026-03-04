"use client";

import { useState } from "react";
import { Swords, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useLiveMatchupQuery } from "@/hooks/useMatchup";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { LiveMatchupPlayer, LiveMatchupTeam } from "@/types/matchup";

const BENCH_SLOTS = new Set(["BE", "IR"]);

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-red-500 uppercase leading-none">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
      </span>
      LIVE
    </span>
  );
}

interface PlayerRowProps {
  player: LiveMatchupPlayer;
}

function PlayerRow({ player }: PlayerRowProps) {
  const isLive = player.live?.game_status === 2;
  const isFinal = player.live?.game_status === 3;
  const liveFpts = player.live?.live_fpts;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/20 hover:bg-muted/30 transition-colors">
      {/* Lineup slot */}
      <span className="shrink-0 w-7 text-[9px] font-mono text-muted-foreground uppercase text-center">
        {player.lineup_slot}
      </span>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-medium truncate block leading-none mb-0.5">
          {player.name}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-muted-foreground uppercase">
            {player.team}
          </span>
          {isLive && <LiveBadge />}
          {isFinal && (
            <span className="text-[9px] font-mono text-muted-foreground/50 uppercase">
              Final
            </span>
          )}
        </div>
      </div>

      {/* Games remaining */}
      <span
        className={cn(
          "shrink-0 text-[9px] font-mono tabular-nums px-1 py-0.5 rounded-sm leading-none",
          player.games_remaining > 0
            ? "text-blue-400 bg-blue-400/10"
            : "text-muted-foreground/40 bg-muted/30"
        )}
      >
        {player.games_remaining}G
      </span>

      {/* Avg / Projected */}
      <div className="shrink-0 text-right w-14">
        {isLive && liveFpts !== undefined && liveFpts !== null ? (
          <span className="font-mono text-xs font-bold tabular-nums text-amber-400">
            {liveFpts.toFixed(1)}
          </span>
        ) : (
          <span className="font-mono text-xs tabular-nums text-foreground">
            {player.avg_points.toFixed(1)}
          </span>
        )}
        <div className="text-[9px] font-mono text-muted-foreground/60 tabular-nums">
          {player.projected_points.toFixed(1)} proj
        </div>
      </div>
    </div>
  );
}

interface TeamRosterListProps {
  team: LiveMatchupTeam;
  showBench: boolean;
}

function TeamRosterList({ team, showBench }: TeamRosterListProps) {
  const starters = team.roster.filter((p) => !BENCH_SLOTS.has(p.lineup_slot));
  const bench = team.roster.filter((p) => BENCH_SLOTS.has(p.lineup_slot));
  const displayed = showBench ? team.roster : starters;

  if (displayed.length === 0) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-[10px] text-muted-foreground">No players</p>
      </div>
    );
  }

  return (
    <div>
      {(showBench ? starters : displayed).map((p) => (
        <PlayerRow key={p.player_id} player={p} />
      ))}
      {showBench && bench.length > 0 && (
        <>
          <div className="px-3 py-0.5 bg-muted/20 border-b border-border/20">
            <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              Bench
            </span>
          </div>
          {bench.map((p) => (
            <PlayerRow key={p.player_id} player={p} />
          ))}
        </>
      )}
    </div>
  );
}

export function MatchupPanel() {
  const { focusedTeamId } = useTerminalStore();
  const { data, isLoading, error } = useLiveMatchupQuery(focusedTeamId);
  const [activeTab, setActiveTab] = useState<"my_team" | "opponent">("my_team");
  const [showBench, setShowBench] = useState(false);

  if (!focusedTeamId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <Swords className="h-7 w-7 text-muted-foreground/25" />
        <p className="text-[10px] text-muted-foreground">No team selected</p>
        <p className="text-[9px] text-muted-foreground/60">Select a team to view matchup</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-2 gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-6 w-full" />
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <p className="text-[10px] text-destructive">Failed to load matchup</p>
      </div>
    );
  }

  const yourTeam = data.your_team;
  const opponentTeam = data.opponent_team;
  const yourScore = yourTeam.current_score;
  const oppScore = opponentTeam.current_score;
  const yourLeading = yourScore > oppScore;
  const margin = Math.abs(data.projected_margin);
  const projWinnerIsYou = data.projected_winner === yourTeam.team_name;
  const showProjectedBadge = margin > 5;

  const activeTeam = activeTab === "my_team" ? yourTeam : opponentTeam;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scoreboard header */}
      <div className="shrink-0 px-3 py-2 border-b border-border/40 bg-muted/10">
        <div className="flex items-center justify-between">
          {/* Your team */}
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider truncate max-w-[90px]">
              {yourTeam.team_name}
            </span>
            <span
              className={cn(
                "font-mono text-xl font-bold tabular-nums leading-none",
                yourLeading ? "text-foreground" : "text-muted-foreground/70"
              )}
            >
              {yourScore.toFixed(1)}
            </span>
          </div>

          {/* VS divider + projected winner */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[9px] font-mono text-muted-foreground/50">vs</span>
            {showProjectedBadge && (
              <span
                className={cn(
                  "text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm leading-none",
                  projWinnerIsYou
                    ? "text-green-500 bg-green-500/10"
                    : "text-red-500 bg-red-500/10"
                )}
              >
                {projWinnerIsYou ? "WIN +" : "LOSS -"}{margin.toFixed(1)}
              </span>
            )}
          </div>

          {/* Opponent team */}
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider truncate max-w-[90px]">
              {opponentTeam.team_name}
            </span>
            <span
              className={cn(
                "font-mono text-xl font-bold tabular-nums leading-none",
                !yourLeading ? "text-foreground" : "text-muted-foreground/70"
              )}
            >
              {oppScore.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Matchup period info */}
        <div className="mt-1 text-[9px] font-mono text-muted-foreground/50 text-center">
          Week {data.matchup_period} &middot; {data.matchup_period_start} &ndash; {data.matchup_period_end}
        </div>
      </div>

      {/* Tab bar + bench toggle */}
      <div className="shrink-0 flex items-center border-b border-border/30 bg-muted/5">
        <button
          className={cn(
            "flex-1 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors",
            activeTab === "my_team"
              ? "text-primary border-b-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
          onClick={() => setActiveTab("my_team")}
        >
          My Team
        </button>
        <button
          className={cn(
            "flex-1 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors",
            activeTab === "opponent"
              ? "text-primary border-b-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
          onClick={() => setActiveTab("opponent")}
        >
          Opponent
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[9px] font-mono text-muted-foreground rounded-none border-l border-border/30"
          onClick={() => setShowBench((v) => !v)}
        >
          {showBench ? (
            <>
              <ChevronUp className="h-2.5 w-2.5 mr-1" />
              Hide Bench
            </>
          ) : (
            <>
              <ChevronDown className="h-2.5 w-2.5 mr-1" />
              Bench
            </>
          )}
        </Button>
      </div>

      {/* Column headers */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-0.5 border-b border-border/20 bg-muted/10">
        <span className="w-7 text-[9px] text-muted-foreground uppercase tracking-wider text-center">
          Slot
        </span>
        <span className="flex-1 text-[9px] text-muted-foreground uppercase tracking-wider">
          Player
        </span>
        <span className="w-6 text-[9px] text-muted-foreground uppercase tracking-wider text-center">
          G
        </span>
        <span className="w-14 text-[9px] text-muted-foreground uppercase tracking-wider text-right">
          FPTS
        </span>
      </div>

      {/* Player list */}
      <div className="flex-1 overflow-y-auto">
        <TeamRosterList team={activeTeam} showBench={showBench} />
      </div>

      {/* Footer: projected scores */}
      <div className="shrink-0 border-t border-border/30 px-3 py-1 flex items-center justify-between bg-muted/10">
        <span className="text-[9px] font-mono text-muted-foreground/60">Projected</span>
        <span className="text-[9px] font-mono tabular-nums text-muted-foreground">
          {yourTeam.projected_score.toFixed(1)}{" "}
          <span className="text-muted-foreground/40">vs</span>{" "}
          {opponentTeam.projected_score.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
