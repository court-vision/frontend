"use client";

import { useMemo } from "react";
import { Users, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useRankingsQuery } from "@/hooks/useRankings";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RankingsPlayer } from "@/types/rankings";

interface ComparisonPlayerCardProps {
  player: RankingsPlayer;
  onRemove: () => void;
  onFocus: () => void;
  isActive: boolean;
}

function ComparisonPlayerCard({
  player,
  onRemove,
  onFocus,
  isActive,
}: ComparisonPlayerCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col p-3 rounded-lg border transition-colors cursor-pointer",
        "hover:border-primary/50",
        isActive ? "border-primary bg-primary/5" : "border-border bg-muted/20"
      )}
      onClick={onFocus}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{player.player_name}</div>
          <div className="text-xs text-muted-foreground font-mono">
            {player.team} · #{player.rank}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 -mt-1 -mr-1 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="text-center py-2">
        <div className="text-2xl font-bold font-mono tabular-nums">
          {player.avg_fpts.toFixed(1)}
        </div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Avg FPTS
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/50">
        <div className="text-center">
          <div className="text-sm font-mono tabular-nums font-medium">
            {player.total_fpts.toFixed(0)}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase">Total</div>
        </div>
        <div className="text-center">
          <div
            className={cn(
              "text-sm font-mono tabular-nums font-medium",
              player.rank_change > 0 && "text-green-500",
              player.rank_change < 0 && "text-red-500"
            )}
          >
            {player.rank_change > 0 && "+"}
            {player.rank_change}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase">Change</div>
        </div>
      </div>
    </div>
  );
}

function EmptySlot({ index }: { index: number }) {
  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-border/50 bg-muted/10 min-h-[140px]">
      <Plus className="h-6 w-6 text-muted-foreground/30 mb-2" />
      <p className="text-xs text-muted-foreground/50 text-center">
        Press <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">c</kbd> to add
      </p>
    </div>
  );
}

export function ComparisonPanel() {
  const {
    comparisonPlayerIds,
    focusedPlayerId,
    setFocusedPlayer,
    removeFromComparison,
    clearComparison,
  } = useTerminalStore();

  const { data: rankings, isLoading } = useRankingsQuery();

  // Map comparison IDs to player data
  const comparisonPlayers = useMemo(() => {
    if (!rankings) return [];
    return comparisonPlayerIds
      .map((id) => rankings.find((p) => p.id === id))
      .filter((p): p is RankingsPlayer => p !== undefined);
  }, [comparisonPlayerIds, rankings]);

  // Calculate stats for comparison summary
  const stats = useMemo(() => {
    if (comparisonPlayers.length === 0) return null;

    const avgFpts =
      comparisonPlayers.reduce((sum, p) => sum + p.avg_fpts, 0) /
      comparisonPlayers.length;
    const bestPlayer = comparisonPlayers.reduce((best, p) =>
      p.avg_fpts > best.avg_fpts ? p : best
    );
    const worstPlayer = comparisonPlayers.reduce((worst, p) =>
      p.avg_fpts < worst.avg_fpts ? p : worst
    );

    return {
      avgFpts,
      bestPlayer,
      worstPlayer,
      spread: bestPlayer.avg_fpts - worstPlayer.avg_fpts,
    };
  }, [comparisonPlayers]);

  if (isLoading) {
    return <ComparisonSkeleton />;
  }

  const hasPlayers = comparisonPlayers.length > 0;
  const slots = [0, 1, 2, 3]; // 4 comparison slots

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium uppercase tracking-wider">
            Comparison
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            ({comparisonPlayers.length}/4)
          </span>
        </div>
        {hasPlayers && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-2 text-[10px]"
            onClick={clearComparison}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {!hasPlayers ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No players to compare</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Press <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">c</kbd> on
              a focused player
            </p>
          </div>
        ) : (
          <>
            {/* Player Cards Grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {slots.map((slotIndex) => {
                const player = comparisonPlayers[slotIndex];
                if (player) {
                  return (
                    <ComparisonPlayerCard
                      key={player.id}
                      player={player}
                      isActive={player.id === focusedPlayerId}
                      onFocus={() => setFocusedPlayer(player.id)}
                      onRemove={() => removeFromComparison(player.id)}
                    />
                  );
                }
                return <EmptySlot key={slotIndex} index={slotIndex} />;
              })}
            </div>

            {/* Comparison Summary */}
            {stats && comparisonPlayers.length >= 2 && (
              <div className="border-t pt-3">
                <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                  Summary
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-muted/30 rounded">
                    <div className="text-xs font-mono font-medium tabular-nums text-green-500">
                      {stats.bestPlayer.player_name.split(" ")[1] || stats.bestPlayer.player_name}
                    </div>
                    <div className="text-[9px] text-muted-foreground">Best</div>
                  </div>
                  <div className="p-2 bg-muted/30 rounded">
                    <div className="text-xs font-mono font-medium tabular-nums">
                      {stats.avgFpts.toFixed(1)}
                    </div>
                    <div className="text-[9px] text-muted-foreground">Group Avg</div>
                  </div>
                  <div className="p-2 bg-muted/30 rounded">
                    <div className="text-xs font-mono font-medium tabular-nums text-amber-500">
                      {stats.spread.toFixed(1)}
                    </div>
                    <div className="text-[9px] text-muted-foreground">Spread</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ComparisonSkeleton() {
  return (
    <div className="flex flex-col h-full p-3 gap-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[140px] w-full" />
        ))}
      </div>
    </div>
  );
}
