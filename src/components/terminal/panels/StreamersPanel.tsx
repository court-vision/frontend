"use client";

import { Zap, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useBreakoutStreamersQuery } from "@/hooks/useBreakoutStreamers";
import { Skeleton } from "@/components/ui/skeleton";
import type { BreakoutCandidateResp } from "@/types/breakout";

interface StreamerCardProps {
  candidate: BreakoutCandidateResp;
  isActive: boolean;
  onFocus: () => void;
}

function StreamerCard({ candidate, isActive, onFocus }: StreamerCardProps) {
  const { beneficiary, injured_player, signals } = candidate;

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
          <span className="text-xs font-medium truncate">{beneficiary.name}</span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            {beneficiary.team}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
          For:{" "}
          <span className="text-amber-500">{injured_player.name}</span>
          {" "}
          <span className="text-muted-foreground/60">({injured_player.status})</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-xs font-bold text-primary tabular-nums">
          {beneficiary.avg_fpts.toFixed(1)}
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">
          {signals.breakout_score.toFixed(0)} pts
        </div>
      </div>
    </button>
  );
}

export function StreamersPanel() {
  const { focusedPlayerId, setFocusedPlayer } = useTerminalStore();
  const { data, isLoading, error } = useBreakoutStreamersQuery(15);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-2 gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertCircle className="h-6 w-6 text-destructive/50 mb-2" />
        <p className="text-sm text-destructive">Failed to load streamers</p>
      </div>
    );
  }

  const candidates = data?.candidates ?? [];

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Zap className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No breakout candidates</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {candidates.map((candidate) => (
          <StreamerCard
            key={candidate.beneficiary.player_id}
            candidate={candidate}
            isActive={candidate.beneficiary.player_id === focusedPlayerId}
            onFocus={() => setFocusedPlayer(candidate.beneficiary.player_id)}
          />
        ))}
      </div>
      {data?.as_of_date && (
        <div className="px-3 py-1 border-t text-[10px] text-muted-foreground font-mono shrink-0">
          As of {data.as_of_date}
        </div>
      )}
    </div>
  );
}
