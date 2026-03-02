"use client";

import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useTodayLeadersQuery } from "@/hooks/useTodayLeadersQuery";
import { Skeleton } from "@/components/ui/skeleton";
import type { LivePlayerData } from "@/types/live";

function StatusBadge({ status }: { status: 1 | 2 | 3 }) {
  if (status === 2) {
    return (
      <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-green-500 shrink-0">
        <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
        LIVE
      </span>
    );
  }
  if (status === 3) {
    return (
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">
        FINAL
      </span>
    );
  }
  return (
    <span className="text-[9px] uppercase tracking-wider text-blue-400 shrink-0">
      SCHED
    </span>
  );
}

interface LeaderRowProps {
  player: LivePlayerData;
  rank: number;
  isActive: boolean;
  onFocus: () => void;
}

function LeaderRow({ player, rank, isActive, onFocus }: LeaderRowProps) {
  return (
    <button
      className={cn(
        "flex items-center gap-2 w-full px-2 py-1 text-left transition-colors",
        "hover:bg-muted/50 border-b border-border/30",
        isActive && "bg-primary/10"
      )}
      onClick={onFocus}
    >
      <span className="w-5 text-[10px] text-muted-foreground font-mono tabular-nums shrink-0 text-right">
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{player.player_name}</div>
      </div>
      <StatusBadge status={player.game_status} />
      <span className="w-10 text-right font-mono text-xs font-bold tabular-nums text-primary shrink-0">
        {player.fpts.toFixed(1)}
      </span>
      <span className="w-6 text-right font-mono text-[11px] tabular-nums text-muted-foreground shrink-0">
        {player.pts}
      </span>
      <span className="w-6 text-right font-mono text-[11px] tabular-nums text-muted-foreground shrink-0">
        {player.reb}
      </span>
      <span className="w-6 text-right font-mono text-[11px] tabular-nums text-muted-foreground shrink-0">
        {player.ast}
      </span>
    </button>
  );
}

export function TodayLeadersPanel() {
  const { focusedPlayerId, setFocusedPlayer } = useTerminalStore();
  const { data: players, isLoading, error } = useTodayLeadersQuery();

  if (isLoading) {
    return <TodayLeadersSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="text-sm text-destructive">Failed to load today&apos;s stats</p>
      </div>
    );
  }

  if (!players || players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Users className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No games today</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sticky header */}
      <div className="flex items-center gap-2 px-2 py-1 border-b bg-card/95 backdrop-blur-sm sticky top-0 shrink-0">
        <span className="w-5 shrink-0" />
        <span className="flex-1 text-[9px] uppercase tracking-wider text-muted-foreground">Player</span>
        <span className="w-10 text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">Status</span>
        <span className="w-10 text-right text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">FPTS</span>
        <span className="w-6 text-right text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">PTS</span>
        <span className="w-6 text-right text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">REB</span>
        <span className="w-6 text-right text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">AST</span>
      </div>
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {players.map((player, index) => (
          <LeaderRow
            key={`${player.player_id}-${player.game_id}`}
            player={player}
            rank={index + 1}
            isActive={player.player_id === focusedPlayerId}
            onFocus={() => setFocusedPlayer(player.player_id)}
          />
        ))}
      </div>
      <div className="px-2 py-1 border-t text-[10px] text-muted-foreground font-mono shrink-0">
        {players.length} players today
      </div>
    </div>
  );
}

function TodayLeadersSkeleton() {
  return (
    <div className="flex flex-col h-full p-2 gap-1">
      {[...Array(10)].map((_, i) => (
        <Skeleton key={i} className="h-7 w-full" />
      ))}
    </div>
  );
}
