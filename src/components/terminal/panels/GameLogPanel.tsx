"use client";

import { useState, useMemo } from "react";
import { Table, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { usePlayerStatsQuery } from "@/hooks/usePlayer";
import { useLivePlayerToday } from "@/hooks/useLiveStats";
import { Skeleton } from "@/components/ui/skeleton";
import type { GameLog } from "@/types/player";
import type { LivePlayerData } from "@/types/live";

type SortKey = keyof GameLog;
type SortDirection = "asc" | "desc";

interface ColumnDef {
  key: SortKey;
  label: string;
  width?: string;
  format?: (value: number) => string;
}

const columns: ColumnDef[] = [
  { key: "date", label: "Date", width: "w-20" },
  { key: "fpts", label: "FPTS", format: (v) => v.toFixed(1) },
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "tov", label: "TO" },
  { key: "min", label: "MIN" },
  { key: "fgm", label: "FGM" },
  { key: "fga", label: "FGA" },
  { key: "fg3m", label: "3PM" },
  { key: "fg3a", label: "3PA" },
];

function parseGameDateParts(dateStr: string): { year: number; month: number; day: number } | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return { year, month, day };
}

function getDateSortValue(dateStr: string): number {
  const parsed = parseGameDateParts(dateStr);
  if (parsed) return Date.UTC(parsed.year, parsed.month - 1, parsed.day);

  const timestamp = new Date(dateStr).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function parseClock(gameClock: string | null): string {
  if (!gameClock) return "";
  const match = gameClock.match(/PT(\d+)M([\d.]+)S/);
  if (!match) return "";
  const secs = Math.floor(parseFloat(match[2])).toString().padStart(2, "0");
  return `${match[1]}:${secs}`;
}

function formatPeriod(period: number | null): string {
  if (!period) return "";
  if (period <= 4) return `Q${period}`;
  return period === 5 ? "OT" : `OT${period - 4}`;
}

function projectFpts(livePlayer: LivePlayerData, avgMinutes: number | undefined): number | null {
  if (!avgMinutes || !livePlayer.min || livePlayer.min <= 0) return null;
  return Math.round((livePlayer.fpts / livePlayer.min) * avgMinutes * 10) / 10;
}

export function GameLogPanel() {
  const { focusedPlayerId, statWindow } = useTerminalStore();
  const { data: playerStats, isLoading, error } = usePlayerStatsQuery(
    focusedPlayerId,
    "nba",
    statWindow
  );
  const { data: livePlayer } = useLivePlayerToday(focusedPlayerId);

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Sort and filter game logs
  const sortedLogs = useMemo(() => {
    if (!playerStats?.game_logs) return [];

    let logs = [...playerStats.game_logs];

    // Filter by stat window
    if (statWindow === "l5") {
      logs = logs.slice(-5);
    } else if (statWindow === "l10") {
      logs = logs.slice(-10);
    } else if (statWindow === "l20") {
      logs = logs.slice(-20);
    }

    // Sort
    logs.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (sortKey === "date") {
        const aDate = getDateSortValue(aVal as string);
        const bDate = getDateSortValue(bVal as string);
        return sortDirection === "asc" ? aDate - bDate : bDate - aDate;
      }

      const aNum = aVal as number;
      const bNum = bVal as number;
      return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
    });

    return logs;
  }, [playerStats?.game_logs, statWindow, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  if (!focusedPlayerId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Table className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No player selected</p>
      </div>
    );
  }

  if (isLoading) {
    return <GameLogSkeleton />;
  }

  if (error || !playerStats) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="text-sm text-destructive">Failed to load game log</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center border-b border-border/50 bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-medium shrink-0">
        {columns.map((col) => (
          <button
            key={col.key}
            onClick={() => handleSort(col.key)}
            className={cn(
              "flex items-center justify-center gap-0.5 py-2 px-1 hover:bg-muted/50 transition-colors",
              col.width || "flex-1",
              sortKey === col.key && "text-foreground"
            )}
          >
            <span>{col.label}</span>
            <SortIcon
              active={sortKey === col.key}
              direction={sortKey === col.key ? sortDirection : undefined}
            />
          </button>
        ))}
      </div>

      {/* Live Row — only rendered when the player is actively mid-game */}
      {livePlayer && (() => {
        const projFpts = projectFpts(livePlayer, playerStats?.avg_stats?.avg_minutes);
        return (
          <div className="flex items-center text-xs font-mono tabular-nums border-b border-amber-500/30 bg-amber-500/5 border-l-2 border-l-amber-500 shrink-0">
            {/* Date cell: LIVE badge + period/clock */}
            <div className="w-20 flex flex-col items-center justify-center py-1.5 px-1 gap-0.5">
              <span className="flex items-center gap-1 text-amber-500 font-semibold text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                LIVE
              </span>
              <span className="text-[9px] text-muted-foreground leading-none">
                {formatPeriod(livePlayer.period)} {parseClock(livePlayer.game_clock)}
              </span>
            </div>

            {/* FPTS cell: current + projected */}
            <div className="flex-1 flex flex-col items-center justify-center py-1.5 px-1">
              <span>{livePlayer.fpts.toFixed(1)}</span>
              {projFpts != null && (
                <span className="text-[9px] text-muted-foreground italic leading-none">
                  ~{projFpts.toFixed(1)}
                </span>
              )}
            </div>

            {/* Remaining stat cells in column order */}
            {(["pts", "reb", "ast", "stl", "blk", "tov", "min", "fgm", "fga", "fg3m", "fg3a"] as const).map((key) => (
              <div key={key} className="flex-1 py-1.5 px-1 text-center">
                {livePlayer[key]}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Table Body */}
      <div className="flex-1 overflow-y-auto">
        {sortedLogs.map((log, index) => (
          <div
            key={log.date}
            className={cn(
              "flex items-center text-xs font-mono tabular-nums border-b border-border/30",
              index % 2 === 0 ? "bg-transparent" : "bg-muted/10"
            )}
          >
            {columns.map((col) => {
              const value = log[col.key];
              const displayValue =
                col.key === "date"
                  ? formatDate(value as string)
                  : col.format
                  ? col.format(value as number)
                  : value;

              const isHighlight =
                col.key === "fpts" && (value as number) >= 40;

              return (
                <div
                  key={col.key}
                  className={cn(
                    "py-1.5 px-1 text-center",
                    col.width || "flex-1",
                    isHighlight && "text-primary font-semibold"
                  )}
                >
                  {displayValue}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-2 py-1 border-t border-border/50 bg-muted/20 text-[10px] text-muted-foreground">
        {sortedLogs.length} games
        {statWindow !== "season" && ` (${statWindow.toUpperCase()})`}
      </div>
    </div>
  );
}

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction?: SortDirection;
}) {
  if (!active) {
    return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  }
  return direction === "asc" ? (
    <ArrowUp className="h-3 w-3" />
  ) : (
    <ArrowDown className="h-3 w-3" />
  );
}

function formatDate(dateStr: string): string {
  const parsed = parseGameDateParts(dateStr);
  if (parsed) {
    return `${parsed.month}/${parsed.day}`;
  }

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function GameLogSkeleton() {
  return (
    <div className="flex flex-col h-full p-2 gap-1">
      <Skeleton className="h-6 w-full" />
      {[...Array(8)].map((_, i) => (
        <Skeleton key={i} className="h-7 w-full" />
      ))}
    </div>
  );
}
