"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useOwnershipTrendingQuery } from "@/hooks/useOwnershipTrending";
import { Skeleton } from "@/components/ui/skeleton";
import type { TrendingPlayer } from "@/types/ownership";

interface TrendingItemProps {
  player: TrendingPlayer;
  type: "rising" | "falling";
  isActive: boolean;
  onFocus: () => void;
}

function TrendingItem({ player, type, isActive, onFocus }: TrendingItemProps) {
  const isRising = type === "rising";

  // Format velocity for display (e.g., +150% or -25%)
  const velocityDisplay =
    player.velocity > 0
      ? `+${Math.round(player.velocity)}%`
      : `${Math.round(player.velocity)}%`;

  // Format ownership change (e.g., +5.2 or -3.1)
  const changeDisplay =
    player.change > 0
      ? `+${player.change.toFixed(1)}`
      : player.change.toFixed(1);

  return (
    <button
      className={cn(
        "flex items-center gap-2 p-1.5 rounded text-sm w-full text-left transition-colors",
        "hover:bg-muted/50",
        isActive && "bg-primary/10 border border-primary/30"
      )}
      onClick={onFocus}
    >
      <div
        className={cn(
          "h-5 w-5 rounded flex items-center justify-center shrink-0",
          isRising ? "bg-green-500/10" : "bg-red-500/10"
        )}
      >
        {isRising ? (
          <TrendingUp className="h-3 w-3 text-green-500" />
        ) : (
          <TrendingDown className="h-3 w-3 text-red-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate text-xs">{player.player_name}</div>
        <div className="text-[10px] text-muted-foreground font-mono">
          {player.team ?? "FA"}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div
          className={cn(
            "font-mono text-[11px] font-medium tabular-nums",
            isRising ? "text-green-500" : "text-red-500"
          )}
          title={`Velocity: ${velocityDisplay}`}
        >
          {changeDisplay}
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">
          {player.current_ownership.toFixed(0)}%
        </div>
      </div>
    </button>
  );
}

export function TrendingPanel() {
  const { focusedPlayerId, setFocusedPlayer } = useTerminalStore();

  // Fetch ownership trending data with velocity-based sorting
  // min_ownership=3 filters out deep roster noise
  // limit=5 for compact display
  const { data, isLoading, error } = useOwnershipTrendingQuery({
    days: 7,
    min_change: 3.0,
    min_ownership: 3.0,
    sort_by: "velocity",
    limit: 5,
  });

  const rising = data?.trending_up ?? [];
  const falling = data?.trending_down ?? [];

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

  // Empty state - show only when no data at all
  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Minus className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No trending data</p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          Based on ownership changes
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Rising Section */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b shrink-0">
          <TrendingUp className="h-3 w-3 text-green-500" />
          <span className="text-[10px] font-medium uppercase tracking-wider">
            Rising
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {rising.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {rising.length === 0 ? (
            <p className="text-[10px] text-muted-foreground text-center py-2">
              No risers
            </p>
          ) : (
            <div className="space-y-0.5">
              {rising.map((player) => (
                <TrendingItem
                  key={player.player_id}
                  player={player}
                  type="rising"
                  isActive={player.player_id === focusedPlayerId}
                  onFocus={() => setFocusedPlayer(player.player_id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Falling Section */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden border-t">
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b shrink-0">
          <TrendingDown className="h-3 w-3 text-red-500" />
          <span className="text-[10px] font-medium uppercase tracking-wider">
            Falling
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {falling.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {falling.length === 0 ? (
            <p className="text-[10px] text-muted-foreground text-center py-2">
              No fallers
            </p>
          ) : (
            <div className="space-y-0.5">
              {falling.map((player) => (
                <TrendingItem
                  key={player.player_id}
                  player={player}
                  type="falling"
                  isActive={player.player_id === focusedPlayerId}
                  onFocus={() => setFocusedPlayer(player.player_id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrendingSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-2">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="space-y-1">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-2 border-t">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="space-y-1">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
