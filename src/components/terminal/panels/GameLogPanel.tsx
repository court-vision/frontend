"use client";

import { useState, useMemo } from "react";
import { Table, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { usePlayerStatsQuery } from "@/hooks/usePlayer";
import { Skeleton } from "@/components/ui/skeleton";
import type { GameLog } from "@/types/player";

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

export function GameLogPanel() {
  const { focusedPlayerId, statWindow } = useTerminalStore();
  const { data: playerStats, isLoading, error } = usePlayerStatsQuery(
    focusedPlayerId,
    "nba"
  );

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
        const aDate = new Date(aVal as string).getTime();
        const bDate = new Date(bVal as string).getTime();
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
  const date = new Date(dateStr);
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
