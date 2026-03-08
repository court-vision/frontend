"use client";

import { useState } from "react";
import { AlertCircle, Calendar } from "lucide-react";
import { cn, getTodayET } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import {
  useMatchupScoreHistoryQuery,
  useDailyMatchupQuery,
} from "@/hooks/useMatchup";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DailyMatchupPlayerStats,
  DailyMatchupFuturePlayer,
} from "@/types/matchup";

const DAY_ABBREV: Record<string, string> = {
  Monday: "MON",
  Tuesday: "TUE",
  Wednesday: "WED",
  Thursday: "THU",
  Friday: "FRI",
  Saturday: "SAT",
  Sunday: "SUN",
};

// Format a game_time_et string (e.g. "7:30 PM ET", "19:30 ET", "7:00 PM") as 12-hour ET
function formatGameTimeET(timeStr: string | null): string {
  if (!timeStr) return "";
  // Already has AM/PM
  if (/[ap]m/i.test(timeStr)) {
    return timeStr
      .replace(/:00\s*([ap]m)/i, "$1") // "7:00 PM" → "7 PM"
      .replace(/\s*ET\s*$/i, "")        // strip trailing ET
      .trim() + " ET";
  }
  // 24-hour format like "19:30" or "19:30 ET"
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = match[2];
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}${m === "00" ? "" : `:${m}`} ${period} ET`;
  }
  return timeStr;
}

function isDailyMatchupFuture(
  player: DailyMatchupPlayerStats | DailyMatchupFuturePlayer
): player is DailyMatchupFuturePlayer {
  return "has_game" in player;
}

function PastPlayerRow({ player }: { player: DailyMatchupPlayerStats }) {
  return (
    <div className="flex items-center gap-2 px-3 py-0.5 hover:bg-muted/30 transition-colors">
      <span className="text-[10px] font-mono text-muted-foreground w-6 shrink-0 uppercase">
        {player.position}
      </span>
      <span className="text-[10px] flex-1 truncate">
        {player.name}
      </span>
      <span className="text-[9px] font-mono text-muted-foreground/60 shrink-0">
        {player.team}
      </span>
      {player.had_game ? (
        <span className="font-mono text-[10px] tabular-nums text-primary shrink-0 w-10 text-right">
          {player.fpts != null ? player.fpts.toFixed(1) : "—"}
        </span>
      ) : (
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/40 shrink-0 w-10 text-right">
          —
        </span>
      )}
    </div>
  );
}

function FuturePlayerRow({ player }: { player: DailyMatchupFuturePlayer }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-0.5 hover:bg-muted/30 transition-colors",
        !player.has_game && "opacity-40"
      )}
    >
      <span className="text-[10px] font-mono text-muted-foreground w-6 shrink-0 uppercase">
        {player.position}
      </span>
      <span className="text-[10px] flex-1 truncate">
        {player.name}
      </span>
      {player.has_game ? (
        <>
          <span className="text-[9px] font-mono text-muted-foreground/60 shrink-0">
            {player.opponent ?? ""}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground shrink-0">
            {formatGameTimeET(player.game_time_et)}
          </span>
        </>
      ) : (
        <span className="text-[10px] text-muted-foreground/40 shrink-0">OFF</span>
      )}
    </div>
  );
}

function DayDetail({ teamId, date }: { teamId: number; date: string }) {
  const { data, isLoading, error } = useDailyMatchupQuery(teamId, date);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-4">
        <p className="text-[10px] text-destructive">Failed to load day data</p>
      </div>
    );
  }

  const day = data;
  const isLive = day.day_type === "today";
  const isPast = day.day_type === "past";
  const isFuture = day.day_type === "future";

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Score row */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border/30">
        {isLive && (
          <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded uppercase tracking-wide">
            TODAY
          </span>
        )}
        {isFuture && (
          <span className="text-[9px] font-mono bg-muted text-muted-foreground px-1 py-0.5 rounded uppercase tracking-wide">
            UPCOMING
          </span>
        )}
        {(isPast || isLive) && (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[10px] font-mono font-semibold text-primary tabular-nums">
              {day.your_team.total_fpts != null
                ? day.your_team.total_fpts.toFixed(1)
                : "—"}
            </span>
            <span className="text-[10px] text-muted-foreground">vs</span>
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
              {day.opponent_team.total_fpts != null
                ? day.opponent_team.total_fpts.toFixed(1)
                : "—"}
            </span>
          </div>
        )}
        <span className="text-[9px] text-muted-foreground/50 font-mono ml-auto">
          {date}
        </span>
      </div>

      {/* Player list */}
      <div className="flex gap-0 divide-x divide-border/20">
        {/* Your team */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="px-3 py-0.5 bg-muted/20">
            <span className="text-[9px] font-mono text-primary/60 uppercase tracking-wide">
              {day.your_team.team_name}
            </span>
          </div>
          <div className="overflow-y-auto max-h-40">
            {day.your_team.roster.map((player) =>
              isDailyMatchupFuture(player) ? (
                <FuturePlayerRow key={player.player_id} player={player} />
              ) : (
                <PastPlayerRow key={player.player_id} player={player} />
              )
            )}
          </div>
        </div>

        {/* Opponent team */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="px-3 py-0.5 bg-muted/20">
            <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wide">
              {day.opponent_team.team_name}
            </span>
          </div>
          <div className="overflow-y-auto max-h-40">
            {day.opponent_team.roster.map((player) =>
              isDailyMatchupFuture(player) ? (
                <FuturePlayerRow key={player.player_id} player={player} />
              ) : (
                <PastPlayerRow key={player.player_id} player={player} />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DailyBreakdownPanel() {
  const { focusedTeamId } = useTerminalStore();
  const today = getTodayET();
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const { data: historyData, isLoading: historyLoading, error: historyError } =
    useMatchupScoreHistoryQuery(focusedTeamId);

  if (!focusedTeamId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Calendar className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No team selected</p>
      </div>
    );
  }

  if (historyLoading) {
    return (
      <div className="flex flex-col h-full p-2 gap-1.5">
        <div className="flex gap-1">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-8 flex-1" />
          ))}
        </div>
        <Skeleton className="flex-1 w-full" />
      </div>
    );
  }

  if (historyError || !historyData) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertCircle className="h-6 w-6 text-destructive/50 mb-2" />
        <p className="text-xs text-destructive">Failed to load matchup data</p>
      </div>
    );
  }

  const history = historyData;
  const dates = history.history.map((p) => p.date);

  // Determine which date to show detail for — default to today if in matchup dates, else last date
  const effectiveSelected = dates.includes(selectedDate)
    ? selectedDate
    : dates[dates.length - 1] ?? today;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day tabs */}
      <div className="flex items-center gap-px px-2 py-1.5 border-b border-border/40 shrink-0 overflow-x-auto scrollbar-none">
        {history.history.map((point) => {
          const dateObj = new Date(point.date + "T00:00:00");
          const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
          const abbrev = DAY_ABBREV[dayName] ?? dayName.slice(0, 3).toUpperCase();
          const isToday = point.date === today;
          const isSelected = effectiveSelected === point.date;
          const lead = point.your_score - point.opponent_score;

          return (
            <button
              key={point.date}
              onClick={() => setSelectedDate(point.date)}
              className={cn(
                "flex flex-col items-center px-2 py-1 rounded text-[9px] font-mono transition-colors shrink-0 min-w-[36px]",
                "hover:bg-muted/60",
                isSelected
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground",
                isToday && !isSelected && "ring-1 ring-primary/30"
              )}
            >
              <span className="uppercase tracking-wide">{abbrev}</span>
              <span
                className={cn(
                  "text-[8px] tabular-nums mt-0.5",
                  lead >= 0 ? "text-emerald-500" : "text-destructive/70"
                )}
              >
                {lead >= 0 ? "+" : ""}{lead.toFixed(0)}
              </span>
            </button>
          );
        })}
        {/* Future dates placeholder if any */}
      </div>

      {/* Day detail */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <DayDetail teamId={focusedTeamId} date={effectiveSelected} />
      </div>
    </div>
  );
}
