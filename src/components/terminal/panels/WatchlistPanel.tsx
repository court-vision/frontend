"use client";

import { useMemo } from "react";
import { Star, Trash2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useRankingsQuery } from "@/hooks/useRankings";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RankingsPlayer } from "@/types/rankings";

interface WatchlistItemProps {
  player: RankingsPlayer;
  isActive: boolean;
  onFocus: () => void;
  onRemove: () => void;
}

function WatchlistItem({ player, isActive, onFocus, onRemove }: WatchlistItemProps) {
  const isPositive = player.rank_change > 0;
  const isNegative = player.rank_change < 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded text-sm cursor-pointer transition-colors",
        "hover:bg-muted/50",
        isActive && "bg-primary/10 border border-primary/30"
      )}
      onClick={onFocus}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{player.player_name}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span>{player.team}</span>
          <span className="text-border">·</span>
          <span>#{player.rank}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="font-mono text-xs font-medium tabular-nums">
            {player.avg_fpts.toFixed(1)}
          </div>
          <div
            className={cn(
              "text-[10px] font-mono tabular-nums",
              isPositive && "text-green-500",
              isNegative && "text-red-500",
              !isPositive && !isNegative && "text-muted-foreground"
            )}
          >
            {isPositive && "+"}
            {player.rank_change !== 0 ? player.rank_change : "-"}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function RecentViewItem({
  player,
  isActive,
  onFocus,
}: {
  player: RankingsPlayer;
  isActive: boolean;
  onFocus: () => void;
}) {
  return (
    <button
      className={cn(
        "flex items-center gap-2 p-1.5 rounded text-xs w-full text-left transition-colors",
        "hover:bg-muted/50",
        isActive && "bg-primary/10"
      )}
      onClick={onFocus}
    >
      <Eye className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="truncate">{player.player_name}</span>
      <span className="text-muted-foreground font-mono ml-auto shrink-0">
        {player.avg_fpts.toFixed(1)}
      </span>
    </button>
  );
}

export function WatchlistPanel() {
  const {
    watchlist,
    recentlyViewed,
    focusedPlayerId,
    setFocusedPlayer,
    removeFromWatchlist,
  } = useTerminalStore();

  const { data: rankings, isLoading } = useRankingsQuery();

  // Map watchlist IDs to player data
  const watchlistPlayers = useMemo(() => {
    if (!rankings) return [];
    return watchlist
      .map((w) => rankings.find((p) => p.id === w.id))
      .filter((p): p is RankingsPlayer => p !== undefined);
  }, [watchlist, rankings]);

  // Map recent views to player data (limit to 5 for display)
  const recentPlayers = useMemo(() => {
    if (!rankings) return [];
    return recentlyViewed
      .slice(0, 5)
      .map((id) => rankings.find((p) => p.id === id))
      .filter((p): p is RankingsPlayer => p !== undefined);
  }, [recentlyViewed, rankings]);

  if (isLoading) {
    return <WatchlistSkeleton />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Watchlist Section */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Watchlist
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            {watchlist.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {watchlistPlayers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <Star className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No players saved</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                Press <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">w</kbd> to add
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {watchlistPlayers.map((player) => (
                <WatchlistItem
                  key={player.id}
                  player={player}
                  isActive={player.id === focusedPlayerId}
                  onFocus={() => setFocusedPlayer(player.id)}
                  onRemove={() => removeFromWatchlist(player.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Views Section */}
      <div className="border-t">
        <div className="flex items-center gap-1.5 px-3 py-2">
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent
          </span>
        </div>
        <div className="px-2 pb-2">
          {recentPlayers.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/70 text-center py-2">
              No recent views
            </p>
          ) : (
            <div className="space-y-0.5">
              {recentPlayers.map((player) => (
                <RecentViewItem
                  key={player.id}
                  player={player}
                  isActive={player.id === focusedPlayerId}
                  onFocus={() => setFocusedPlayer(player.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WatchlistSkeleton() {
  return (
    <div className="flex flex-col h-full p-3 gap-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
