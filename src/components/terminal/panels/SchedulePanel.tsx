"use client";

import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGamesOnDateQuery, getTodayDate } from "@/hooks/useGames";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { GameInfo } from "@/types/games";

// NBA team colors (simplified - primary colors)
const TEAM_COLORS: Record<string, string> = {
  ATL: "bg-red-600",
  BOS: "bg-green-600",
  BKN: "bg-gray-800",
  CHA: "bg-teal-500",
  CHI: "bg-red-600",
  CLE: "bg-red-700",
  DAL: "bg-blue-600",
  DEN: "bg-yellow-500",
  DET: "bg-red-600",
  GSW: "bg-yellow-500",
  HOU: "bg-red-600",
  IND: "bg-yellow-500",
  LAC: "bg-red-600",
  LAL: "bg-purple-600",
  MEM: "bg-blue-400",
  MIA: "bg-red-600",
  MIL: "bg-green-600",
  MIN: "bg-blue-600",
  NOP: "bg-blue-600",
  NYK: "bg-orange-500",
  OKC: "bg-blue-500",
  ORL: "bg-blue-600",
  PHI: "bg-blue-600",
  PHX: "bg-orange-500",
  POR: "bg-red-600",
  SAC: "bg-purple-600",
  SAS: "bg-gray-600",
  TOR: "bg-red-600",
  UTA: "bg-yellow-500",
  WAS: "bg-blue-600",
};

function getTeamColor(team: string): string {
  return TEAM_COLORS[team] || "bg-gray-500";
}

interface GameCardProps {
  game: GameInfo;
}

function GameCard({ game }: GameCardProps) {
  const isLive = game.status === "in_progress";
  const isFinal = game.status === "final";
  const isScheduled = game.status === "scheduled";

  return (
    <div
      className={cn(
        "p-2 rounded border transition-colors",
        isLive && "border-green-500/50 bg-green-500/5",
        isFinal && "border-border bg-muted/20",
        isScheduled && "border-border/50 bg-transparent"
      )}
    >
      {/* Status indicator */}
      <div className="flex items-center justify-between mb-2">
        <div
          className={cn(
            "text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded",
            isLive && "bg-green-500/20 text-green-500",
            isFinal && "bg-muted text-muted-foreground",
            isScheduled && "bg-blue-500/20 text-blue-400"
          )}
        >
          {isLive && "LIVE"}
          {isFinal && "FINAL"}
          {isScheduled && "UPCOMING"}
        </div>
        {game.arena && (
          <span className="text-[9px] text-muted-foreground truncate max-w-[80px]">
            {game.arena}
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="space-y-1.5">
        {/* Away team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("w-1 h-4 rounded-full", getTeamColor(game.away_team))} />
            <span className="font-mono text-xs font-medium">{game.away_team}</span>
          </div>
          {(isFinal || isLive) && game.away_score !== null && (
            <span
              className={cn(
                "font-mono text-sm font-bold tabular-nums",
                isFinal &&
                  game.away_score > (game.home_score || 0) &&
                  "text-green-500"
              )}
            >
              {game.away_score}
            </span>
          )}
        </div>

        {/* Home team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("w-1 h-4 rounded-full", getTeamColor(game.home_team))} />
            <span className="font-mono text-xs font-medium">{game.home_team}</span>
          </div>
          {(isFinal || isLive) && game.home_score !== null && (
            <span
              className={cn(
                "font-mono text-sm font-bold tabular-nums",
                isFinal &&
                  game.home_score > (game.away_score || 0) &&
                  "text-green-500"
              )}
            >
              {game.home_score}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function SchedulePanel() {
  const [selectedDate, setSelectedDate] = useState(getTodayDate);
  const { data, isLoading, error } = useGamesOnDateQuery(selectedDate);

  const goToPreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split("T")[0]);
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split("T")[0]);
  };

  const goToToday = () => {
    setSelectedDate(getTodayDate());
  };

  const isToday = selectedDate === getTodayDate();

  // Format date for display
  const displayDate = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  if (isLoading) {
    return <ScheduleSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="text-sm text-destructive">Failed to load schedule</p>
      </div>
    );
  }

  const games = data?.games || [];
  const liveGames = games.filter((g) => g.status === "in_progress");
  const completedGames = games.filter((g) => g.status === "final");
  const upcomingGames = games.filter((g) => g.status === "scheduled");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header with date navigation */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium uppercase tracking-wider">
            Schedule
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={goToPreviousDay}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <button
            className={cn(
              "text-[10px] font-mono px-2 py-0.5 rounded transition-colors",
              isToday ? "bg-primary/10 text-primary" : "hover:bg-muted"
            )}
            onClick={goToToday}
          >
            {displayDate}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={goToNextDay}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {games.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Calendar className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No games scheduled</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Live games section */}
            {liveGames.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] uppercase tracking-wider text-green-500 font-medium">
                    Live ({liveGames.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {liveGames.map((game) => (
                    <GameCard key={game.game_id} game={game} />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming games section */}
            {upcomingGames.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="h-3 w-3 text-blue-400" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Upcoming ({upcomingGames.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {upcomingGames.map((game) => (
                    <GameCard key={game.game_id} game={game} />
                  ))}
                </div>
              </div>
            )}

            {/* Completed games section */}
            {completedGames.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Trophy className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Final ({completedGames.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {completedGames.map((game) => (
                    <GameCard key={game.game_id} game={game} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with game count */}
      <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground font-mono text-center">
        {games.length} game{games.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="flex flex-col h-full p-3 gap-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
