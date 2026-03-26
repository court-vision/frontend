"use client";

import { Users, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useNBATeamRosterQuery } from "@/hooks/useNBATeam";
import { Skeleton } from "@/components/ui/skeleton";
import type { NBATeamRosterPlayer } from "@/types/nba-team";

// --- Position badge colors ---
function positionColor(pos: string | null): string {
  if (!pos) return "bg-muted/30 text-muted-foreground/50 border-border/30";
  if (pos.startsWith("G")) return "bg-sky-500/15 text-sky-400 border-sky-500/20";
  if (pos === "C") return "bg-amber-500/15 text-amber-400 border-amber-500/20";
  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"; // F / F-C / G-F
}

function PositionBadge({ position }: { position: string | null }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-7 shrink-0",
        "text-[8px] font-bold border rounded px-0.5 py-0.5 font-mono",
        positionColor(position)
      )}
    >
      {position ?? "—"}
    </span>
  );
}

function InjuryBadge({ status }: { status: string }) {
  const isOut = status === "Out" || status === "Doubtful";
  return (
    <span
      className={cn(
        "inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold border font-mono shrink-0",
        isOut
          ? "bg-red-500/15 text-red-400 border-red-500/25"
          : "bg-amber-500/15 text-amber-400 border-amber-500/25"
      )}
    >
      {status === "Questionable" ? "GTD" : status === "Out" ? "OUT" : status === "Doubtful" ? "D" : status[0]}
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
  const fg = player.fg_pct !== null ? `${(player.fg_pct * 100).toFixed(1)}` : "—";
  const fpts = player.fpts.toFixed(1);

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 w-full px-2 py-1.5 border-b border-border/20",
        "text-[10px] font-mono text-left",
        "hover:bg-primary/5 transition-colors cursor-pointer",
        "group relative"
      )}
    >
      {/* Left accent on hover */}
      <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform origin-center rounded-full" />

      <PositionBadge position={player.position} />

      {/* Name + injury */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="truncate text-foreground/80 group-hover:text-foreground transition-colors">
          {player.name}
        </span>
        {player.injury_status && <InjuryBadge status={player.injury_status} />}
      </div>

      {/* FPTS — primary color, widest */}
      <span className="shrink-0 w-9 text-right text-primary font-semibold tabular-nums">
        {fpts}
      </span>

      {/* Stats */}
      <span className="shrink-0 w-7 text-right text-foreground/80 tabular-nums">{player.pts.toFixed(1)}</span>
      <span className="shrink-0 w-7 text-right text-sky-400/75 tabular-nums">{player.reb.toFixed(1)}</span>
      <span className="shrink-0 w-7 text-right text-emerald-400/75 tabular-nums">{player.ast.toFixed(1)}</span>
      <span className="shrink-0 w-9 text-right text-muted-foreground/45 tabular-nums">{fg}%</span>
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
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
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
    <div className="flex flex-col h-full overflow-hidden font-mono">
      {/* Column headers */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/40 bg-muted/10 shrink-0">
        <span className="w-7" />
        <span className="flex-1 text-[8px] uppercase tracking-wider text-muted-foreground/40">Player</span>
        <span className="w-9 text-right text-[8px] uppercase tracking-wider text-primary/50">FPTS</span>
        <span className="w-7 text-right text-[8px] uppercase tracking-wider text-foreground/30">PTS</span>
        <span className="w-7 text-right text-[8px] uppercase tracking-wider text-sky-400/40">REB</span>
        <span className="w-7 text-right text-[8px] uppercase tracking-wider text-emerald-400/40">AST</span>
        <span className="w-9 text-right text-[8px] uppercase tracking-wider text-muted-foreground/30">FG%</span>
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

      <div className="px-3 py-1 border-t border-border/25 bg-muted/10 text-[8px] text-muted-foreground/35 shrink-0 flex items-center justify-between">
        <span>{roster.players.length} players</span>
        <span className="text-muted-foreground/25">click to focus · sorted by fpts</span>
      </div>
    </div>
  );
}
