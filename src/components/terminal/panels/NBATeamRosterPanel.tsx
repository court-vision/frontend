"use client";

import { Users, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useNBATeamRosterQuery } from "@/hooks/useNBATeam";
import { Skeleton } from "@/components/ui/skeleton";
import type { NBATeamRosterPlayer } from "@/types/nba-team";

function InjuryBadge({ status }: { status: string }) {
  const color =
    status === "Out" || status === "Doubtful"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return (
    <span className={cn("px-1 py-0.5 rounded text-[8px] font-bold border font-mono shrink-0", color)}>
      {status === "Questionable" ? "Q" : status === "Out" ? "OUT" : status === "Doubtful" ? "D" : status[0]}
    </span>
  );
}

function PlayerRow({
  player,
  onClick,
}: {
  player: NBATeamRosterPlayer;
  onClick: () => void;
}) {
  const fgPct = player.fg_pct !== null ? `${(player.fg_pct * 100).toFixed(1)}%` : "—";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 w-full px-3 py-1.5 border-b border-border/20",
        "text-[10px] font-mono text-left",
        "hover:bg-primary/5 transition-colors cursor-pointer"
      )}
    >
      {/* Position */}
      <span className="shrink-0 w-5 text-center text-muted-foreground/50 text-[9px]">
        {player.position ?? "—"}
      </span>

      {/* Name + injury */}
      <div className="flex-1 min-w-0 flex items-center gap-1">
        <span className="truncate text-foreground/85">{player.name}</span>
        {player.injury_status && <InjuryBadge status={player.injury_status} />}
      </div>

      {/* Stats */}
      <div className="shrink-0 flex items-center gap-2 tabular-nums text-muted-foreground/70">
        <span className="w-7 text-right text-foreground/80">{player.pts.toFixed(1)}</span>
        <span className="w-7 text-right">{player.reb.toFixed(1)}</span>
        <span className="w-7 text-right">{player.ast.toFixed(1)}</span>
        <span className="w-10 text-right">{fgPct}</span>
      </div>
    </button>
  );
}

export function NBATeamRosterPanel() {
  const { focusedNBATeamId, setFocusedPlayer } = useTerminalStore();
  const { data: roster, isLoading, error } = useNBATeamRosterQuery(focusedNBATeamId);

  if (!focusedNBATeamId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Users className="h-6 w-6 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No team selected</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    );
  }

  if (error || !roster) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertCircle className="h-5 w-5 text-destructive/50 mb-2" />
        <p className="text-xs text-destructive">Failed to load roster</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Column headers */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-border/40 text-[9px] uppercase tracking-wider text-muted-foreground/50 font-mono shrink-0">
        <span className="w-5" />
        <span className="flex-1">Player</span>
        <div className="flex items-center gap-2">
          <span className="w-7 text-right">PTS</span>
          <span className="w-7 text-right">REB</span>
          <span className="w-7 text-right">AST</span>
          <span className="w-10 text-right">FG%</span>
        </div>
      </div>

      {/* Player list */}
      <div className="flex-1 overflow-y-auto">
        {roster.players.map((player) => (
          <PlayerRow
            key={player.player_id}
            player={player}
            onClick={() => setFocusedPlayer(player.player_id)}
          />
        ))}
        {roster.players.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/40">
            No players found
          </div>
        )}
      </div>

      <div className="px-3 py-1 border-t border-border/30 text-[9px] text-muted-foreground/40 font-mono shrink-0">
        {roster.players.length} players · sorted by FPTS · click to focus
      </div>
    </div>
  );
}
