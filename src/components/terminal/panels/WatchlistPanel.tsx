"use client";

import { useMemo, useState } from "react";
import { Star, Trash2, Eye, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useRankingsQuery } from "@/hooks/useRankings";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelContainer } from "../core";
import type { RankingsPlayer } from "@/types/rankings";

// Height constants for dynamic sizing
const ITEM_HEIGHT = 44; // px - height per watchlist item
const MIN_VISIBLE_ITEMS = 3; // Minimum items to show space for
const MAX_VISIBLE_ITEMS = 6; // Maximum items before scrolling
const COLLAPSED_RECENT_HEIGHT = 28; // px - just the "Recent" header when collapsed

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
        <div className="font-medium truncate text-xs">{player.player_name}</div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
          <span>{player.team}</span>
          <span className="text-border">·</span>
          <span>#{player.rank}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
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
          className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
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
  const [recentExpanded, setRecentExpanded] = useState(false);
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

  // Map recent views to player data (limit to 3 for compact display)
  const recentPlayers = useMemo(() => {
    if (!rankings) return [];
    return recentlyViewed
      .slice(0, 3)
      .map((id) => rankings.find((p) => p.id === id))
      .filter((p): p is RankingsPlayer => p !== undefined);
  }, [recentlyViewed, rankings]);

  // Calculate dynamic height - show space for at least MIN_VISIBLE_ITEMS
  const dynamicHeight = useMemo(() => {
    const itemCount = watchlistPlayers.length;
    const visibleItems = Math.max(MIN_VISIBLE_ITEMS, Math.min(itemCount, MAX_VISIBLE_ITEMS));
    // Header (toolbar ~32px) + items + collapsed recent bar + padding
    return 30 + (visibleItems * ITEM_HEIGHT) + COLLAPSED_RECENT_HEIGHT + 4;
  }, [watchlistPlayers.length]);

  const hasMoreItems = watchlistPlayers.length > MAX_VISIBLE_ITEMS;

  if (isLoading) {
    return (
      <PanelContainer
        definitionId="watchlist"
        showClose={false}
        showMaximize={false}
        className="shrink-0"
        style={{ height: 32 + (MIN_VISIBLE_ITEMS * ITEM_HEIGHT) + COLLAPSED_RECENT_HEIGHT + 8 }}
      >
        <WatchlistSkeleton />
      </PanelContainer>
    );
  }

  return (
    <PanelContainer
      definitionId="watchlist"
      showClose={false}
      showMaximize={false}
      className="shrink-0 transition-all duration-200"
      style={{ height: dynamicHeight }}
    >
      <div className="relative flex flex-col h-full overflow-hidden">
        {/* Watchlist Section */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {watchlistPlayers.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center h-full">
              <Star className="h-6 w-6 text-muted-foreground/30 mb-1" />
              <p className="text-[10px] text-muted-foreground">
                Press <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">w</kbd> to add players
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

        {/* Recent Views Section - Collapsible */}
        <div className="relative shrink-0">
          {/* Collapsed bar - always visible */}
          <button
            onClick={() => setRecentExpanded(!recentExpanded)}
            className={cn(
              "flex items-center justify-between w-full px-3 py-1.5 border-t",
              "hover:bg-muted/50 transition-colors",
              recentExpanded && "bg-muted/30"
            )}
          >
            <div className="flex items-center gap-1.5">
              <Eye className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Recent
              </span>
              {recentPlayers.length > 0 && (
                <span className="text-[10px] text-muted-foreground/70">
                  ({recentPlayers.length})
                </span>
              )}
            </div>
            {recentExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-3 w-3 text-muted-foreground" />
            )}
          </button>

          {/* Expanded overlay */}
          {recentExpanded && (
            <div className="absolute bottom-full left-0 right-0 bg-popover border border-border rounded-t-md shadow-lg z-10">
              <div className="p-2">
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
                        onFocus={() => {
                          setFocusedPlayer(player.id);
                          setRecentExpanded(false);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {hasMoreItems && (
          <div className="absolute bottom-7 left-0 right-0 h-4 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        )}
      </div>
    </PanelContainer>
  );
}

function WatchlistSkeleton() {
  return (
    <div className="flex flex-col h-full p-2 gap-2">
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
