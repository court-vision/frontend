"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useRankingsQuery } from "@/hooks/useRankings";
import { Skeleton } from "@/components/ui/skeleton";
import type { RankingsPlayer } from "@/types/rankings";

interface TrendingItemProps {
  player: RankingsPlayer;
  type: "rising" | "falling";
  isActive: boolean;
  onFocus: () => void;
}

function TrendingItem({ player, type, isActive, onFocus }: TrendingItemProps) {
  const isRising = type === "rising";

  return (
    <button
      className={cn(
        "flex items-center gap-2 p-2 rounded text-sm w-full text-left transition-colors",
        "hover:bg-muted/50",
        isActive && "bg-primary/10 border border-primary/30"
      )}
      onClick={onFocus}
    >
      <div
        className={cn(
          "h-6 w-6 rounded flex items-center justify-center shrink-0",
          isRising ? "bg-green-500/10" : "bg-red-500/10"
        )}
      >
        {isRising ? (
          <TrendingUp className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-red-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate text-xs">{player.player_name}</div>
        <div className="text-[10px] text-muted-foreground font-mono">
          {player.team}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div
          className={cn(
            "font-mono text-xs font-medium tabular-nums",
            isRising ? "text-green-500" : "text-red-500"
          )}
        >
          {isRising ? "+" : ""}
          {player.rank_change}
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">
          #{player.rank}
        </div>
      </div>
    </button>
  );
}

export function TrendingPanel() {
  const { focusedPlayerId, setFocusedPlayer } = useTerminalStore();
  const { data: rankings, isLoading, error } = useRankingsQuery();

  // Calculate rising and falling players from rankings data
  // Using rank_change as a proxy for trending (positive = rising, negative = falling)
  const { rising, falling } = useMemo(() => {
    if (!rankings) return { rising: [], falling: [] };

    // Sort by rank change and take top movers
    const sorted = [...rankings].sort((a, b) => b.rank_change - a.rank_change);

    const rising = sorted
      .filter((p) => p.rank_change > 0)
      .slice(0, 5);

    const falling = sorted
      .filter((p) => p.rank_change < 0)
      .slice(-5)
      .reverse();

    return { rising, falling };
  }, [rankings]);

  if (isLoading) {
    return <TrendingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="text-sm text-destructive">Failed to load trending data</p>
      </div>
    );
  }

  const hasData = rising.length > 0 || falling.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Rising Section */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b">
          <TrendingUp className="h-3.5 w-3.5 text-green-500" />
          <span className="text-xs font-medium uppercase tracking-wider">
            Rising
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {rising.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-muted-foreground">No risers</p>
            </div>
          ) : (
            <div className="space-y-1">
              {rising.map((player) => (
                <TrendingItem
                  key={player.id}
                  player={player}
                  type="rising"
                  isActive={player.id === focusedPlayerId}
                  onFocus={() => setFocusedPlayer(player.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Falling Section */}
      <div className="flex-1 min-h-0 flex flex-col border-t">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b">
          <TrendingDown className="h-3.5 w-3.5 text-red-500" />
          <span className="text-xs font-medium uppercase tracking-wider">
            Falling
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {falling.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-muted-foreground">No fallers</p>
            </div>
          ) : (
            <div className="space-y-1">
              {falling.map((player) => (
                <TrendingItem
                  key={player.id}
                  player={player}
                  type="falling"
                  isActive={player.id === focusedPlayerId}
                  onFocus={() => setFocusedPlayer(player.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Future: ownership trending indicator */}
      {!hasData && (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <Minus className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">No trending data</p>
        </div>
      )}
    </div>
  );
}

function TrendingSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-3">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-3 border-t">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
