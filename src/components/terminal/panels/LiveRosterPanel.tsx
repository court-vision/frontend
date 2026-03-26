"use client";

import { useMemo } from "react";
import { Activity, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useFocusPlayer } from "@/hooks/useFocusPlayer";
import { useLiveMatchupQuery } from "@/hooks/useMatchup";
import { Skeleton } from "@/components/ui/skeleton";
import type { LiveMatchupPlayer } from "@/types/matchup";

const POSITION_COLORS: Record<string, string> = {
  PG: "text-blue-400 bg-blue-400/10",
  SG: "text-violet-400 bg-violet-400/10",
  SF: "text-green-400 bg-green-400/10",
  PF: "text-amber-400 bg-amber-400/10",
  C: "text-red-400 bg-red-400/10",
};

const LINEUP_SLOT_ORDER: Record<string, number> = {
  PG: 1, SG: 2, SF: 3, PF: 4, C: 5, G: 6, F: 7, UT: 8, BE: 9, IR: 10,
};

const GAME_STATUS_BUCKET: Record<number, number> = { 2: 0, 1: 1, 3: 2 };

function formatGameClock(clock: string | null): string {
  if (!clock) return "";
  const match = clock.match(/PT(\d+)M([\d.]+)S/);
  if (match) {
    const mins = parseInt(match[1], 10);
    const secs = Math.floor(parseFloat(match[2]));
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  return clock;
}

function sortRoster(roster: LiveMatchupPlayer[]): LiveMatchupPlayer[] {
  return [...roster].sort((a, b) => {
    const bucketA = a.live ? (GAME_STATUS_BUCKET[a.live.game_status] ?? 1) : 1;
    const bucketB = b.live ? (GAME_STATUS_BUCKET[b.live.game_status] ?? 1) : 1;
    if (bucketA !== bucketB) return bucketA - bucketB;
    const slotA = LINEUP_SLOT_ORDER[a.lineup_slot] ?? 99;
    const slotB = LINEUP_SLOT_ORDER[b.lineup_slot] ?? 99;
    return slotA - slotB;
  });
}

function LiveStateChip({ player }: { player: LiveMatchupPlayer }) {
  const { live } = player;

  if (!live) {
    return (
      <div className="flex flex-col items-end shrink-0 min-w-[48px]">
        <span className="text-[9px] font-mono tabular-nums text-foreground/70">
          {player.avg_points.toFixed(1)}
        </span>
        <span className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-wide">
          AVG
        </span>
      </div>
    );
  }

  if (live.game_status === 1) {
    return (
      <div className="flex flex-col items-end shrink-0 min-w-[48px]">
        <span className="text-[9px] font-mono text-blue-400/70 bg-blue-400/10 px-1 rounded">
          TIP
        </span>
      </div>
    );
  }

  if (live.game_status === 2) {
    const clock = formatGameClock(live.game_clock);
    const clockStr = live.period
      ? `Q${live.period > 4 ? `OT` : live.period} ${clock}`
      : clock;
    return (
      <div className="flex flex-col items-end shrink-0 min-w-[56px]">
        <div className="flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="text-[9px] font-mono text-emerald-400 tabular-nums">
            {clockStr}
          </span>
        </div>
        <span className="text-[9px] font-mono tabular-nums text-muted-foreground/70">
          {live.live_pts}/{live.live_reb}/{live.live_ast}
        </span>
        <span className="text-[10px] font-mono font-bold tabular-nums text-emerald-400">
          {live.live_fpts.toFixed(1)}
        </span>
      </div>
    );
  }

  // game_status === 3 (final)
  return (
    <div className="flex flex-col items-end shrink-0 min-w-[56px]">
      <span className="text-[8px] font-mono text-muted-foreground/50 uppercase tracking-wide">
        FINAL
      </span>
      <span className="text-[9px] font-mono tabular-nums text-muted-foreground/70">
        {live.live_pts}/{live.live_reb}/{live.live_ast}
      </span>
      <span className="text-[10px] font-mono font-bold tabular-nums text-foreground">
        {live.live_fpts.toFixed(1)}
      </span>
    </div>
  );
}

interface LiveRosterRowProps {
  player: LiveMatchupPlayer;
  isActive: boolean;
  onFocus: () => void;
}

function LiveRosterRow({ player, isActive, onFocus }: LiveRosterRowProps) {
  const position = player.position ?? "?";
  const posColor = POSITION_COLORS[position] ?? "text-muted-foreground bg-muted";

  return (
    <button
      className={cn(
        "flex items-center gap-2 w-full px-3 py-1.5 text-left transition-colors border-b border-border/20",
        "hover:bg-muted/40",
        isActive && "bg-primary/10"
      )}
      onClick={onFocus}
    >
      {/* Position badge */}
      <span
        className={cn(
          "shrink-0 inline-flex items-center justify-center w-7 h-4 rounded-sm text-[9px] font-mono font-bold uppercase tracking-wider",
          posColor
        )}
      >
        {position}
      </span>

      {/* Name + team */}
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-medium truncate block leading-none mb-0.5">
          {player.name}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
          {player.team}
        </span>
      </div>

      {/* Injury badge */}
      {player.injured && (
        <span
          className={cn(
            "shrink-0 text-[9px] font-mono font-bold uppercase px-1 py-0.5 rounded-sm leading-none",
            player.injury_status === "OUT"
              ? "text-red-500 bg-red-500/10"
              : "text-amber-500 bg-amber-500/10"
          )}
        >
          {player.injury_status ?? "OUT"}
        </span>
      )}

      {/* Live state */}
      <LiveStateChip player={player} />
    </button>
  );
}

export function LiveRosterPanel() {
  const { focusedTeamId } = useTerminalStore();
  const focusPlayer = useFocusPlayer();
  const { data, isLoading, error } = useLiveMatchupQuery(focusedTeamId);

  const sorted = useMemo(() => {
    if (!data?.your_team.roster) return [];
    return sortRoster(data.your_team.roster);
  }, [data]);

  const { anyLive, liveTotal } = useMemo(() => {
    const roster = data?.your_team.roster ?? [];
    const anyLive = roster.some((p) => p.live?.game_status === 2);
    const liveTotal = roster.reduce((s, p) => s + (p.live?.live_fpts ?? 0), 0);
    return { anyLive, liveTotal };
  }, [data]);

  if (!focusedTeamId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <Users className="h-7 w-7 text-muted-foreground/25" />
        <p className="text-[10px] text-muted-foreground">No team selected</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-2 gap-1.5">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <Activity className="h-6 w-6 text-destructive/50 mb-1" />
        <p className="text-[10px] text-destructive">Failed to load live roster</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary strip */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1 border-b border-border/40 bg-muted/10">
        {anyLive ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
              LIVE
            </span>
            <span className="text-muted-foreground/30 text-[9px]">·</span>
            <span className="text-[9px] font-mono tabular-nums text-foreground">
              {liveTotal.toFixed(1)} fpts
            </span>
          </>
        ) : (
          <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
            ROSTER
          </span>
        )}
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-border/30 bg-muted/20 shrink-0">
        <span className="w-7 text-[9px] text-muted-foreground uppercase tracking-wider">
          POS
        </span>
        <span className="flex-1 text-[9px] text-muted-foreground uppercase tracking-wider">
          Player
        </span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider text-right">
          Status
        </span>
      </div>

      {/* Player rows */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[10px] text-muted-foreground">No roster data</p>
          </div>
        ) : (
          sorted.map((player) => (
            <LiveRosterRow
              key={player.player_id}
              player={player}
              isActive={false}
              onFocus={() => focusPlayer(player.live?.nba_player_id ?? player.player_id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
