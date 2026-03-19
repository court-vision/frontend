"use client";

import { Activity, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useNBATeamLiveGameQuery } from "@/hooks/useNBATeam";
import { NBA_TEAM_BY_ABBREV } from "@/lib/nbaTeams";
import { Skeleton } from "@/components/ui/skeleton";
import type { TopPerformer, InjuredPlayer } from "@/types/games";

function formatGameClock(clock: string | null): string {
  if (!clock) return "";
  // ISO 8601: "PT07M23.00S" → "7:23"
  const match = clock.match(/PT(\d+)M([\d.]+)S/);
  if (match) {
    const mins = parseInt(match[1], 10);
    const secs = Math.floor(parseFloat(match[2]));
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  return clock;
}

function statusLabel(status: string, period: number | null, gameClock: string | null): string {
  if (status === "final") return "FINAL";
  if (status === "in_progress") {
    const clock = formatGameClock(gameClock);
    if (period && period > 4) return `OT ${clock}`;
    return `Q${period ?? "?"} ${clock}`;
  }
  return "SCHEDULED";
}

function InjuryStatusBadge({ status }: { status: string }) {
  const color =
    status === "Out"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : status === "Doubtful"
      ? "bg-red-500/10 text-red-400/80 border-red-500/20"
      : "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return (
    <span className={cn("px-1 py-0.5 rounded text-[8px] font-bold border font-mono shrink-0", color)}>
      {status.toUpperCase()}
    </span>
  );
}

function PerformerRow({ p }: { p: TopPerformer }) {
  const fgStr = p.fga > 0 ? `${p.fgm}/${p.fga}` : "—";
  return (
    <div className="flex items-center gap-2 px-2 py-1 border-b border-border/20 text-[10px] font-mono">
      <span className="flex-1 min-w-0 truncate text-foreground/80">{p.name}</span>
      <span className="shrink-0 tabular-nums">
        <span className="text-foreground">{p.pts}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-foreground/70">{p.reb}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-foreground/70">{p.ast}</span>
      </span>
      <span className="shrink-0 text-muted-foreground/50 w-10 text-right">{fgStr}</span>
    </div>
  );
}

function InjuryRow({ p }: { p: InjuredPlayer }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 border-b border-border/20 text-[10px] font-mono">
      <span className="flex-1 min-w-0 truncate text-foreground/80">{p.name}</span>
      <InjuryStatusBadge status={p.status} />
      {p.injury_type && (
        <span className="text-muted-foreground/50 shrink-0 truncate max-w-[80px]">{p.injury_type}</span>
      )}
    </div>
  );
}

export function NBATeamLiveGamePanel() {
  const { focusedNBATeamId } = useTerminalStore();
  const { data: game, isLoading, error } = useNBATeamLiveGameQuery(focusedNBATeamId);

  if (!focusedNBATeamId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Activity className="h-6 w-6 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No team selected</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertCircle className="h-5 w-5 text-destructive/50 mb-2" />
        <p className="text-xs text-destructive">Failed to load game data</p>
      </div>
    );
  }

  const homeInfo = NBA_TEAM_BY_ABBREV[game.home_team];
  const awayInfo = NBA_TEAM_BY_ABBREV[game.away_team];
  const isLive = game.status === "in_progress";
  const isFinal = game.status === "final";
  const isScheduled = game.status === "scheduled";

  return (
    <div className="flex flex-col h-full overflow-hidden font-mono">
      {/* Score header */}
      <div className="px-3 py-2 border-b border-border/50 shrink-0">
        <div className="flex items-center justify-between gap-2">
          {/* Away team */}
          <div className="flex flex-col items-center min-w-[60px]">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">
              {awayInfo?.abbrev ?? game.away_team}
            </span>
            {!isScheduled && (
              <span className={cn("text-2xl font-bold tabular-nums leading-none mt-0.5",
                isFinal && game.away_score !== null && game.home_score !== null
                  ? game.away_score > game.home_score ? "text-green-400" : "text-muted-foreground/60"
                  : "text-foreground"
              )}>
                {game.away_score ?? "—"}
              </span>
            )}
          </div>

          {/* Center: status */}
          <div className="flex flex-col items-center flex-1">
            {isScheduled ? (
              <>
                <span className="text-xs text-foreground/70">
                  {awayInfo?.name ?? game.away_team} @ {homeInfo?.name ?? game.home_team}
                </span>
                <span className="text-[10px] text-primary mt-0.5">
                  {game.is_today
                    ? game.start_time_et
                      ? `${game.start_time_et} ET`
                      : game.game_date
                    : new Date(game.game_date + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      }) + (game.start_time_et ? ` · ${game.start_time_et} ET` : "")}
                </span>
                {game.arena && (
                  <span className="text-[9px] text-muted-foreground/50 mt-0.5">{game.arena}</span>
                )}
              </>
            ) : (
              <>
                <span className={cn(
                  "text-[10px] font-bold tracking-wider",
                  isLive ? "text-primary animate-pulse" : "text-muted-foreground"
                )}>
                  {statusLabel(game.status, game.period, game.game_clock)}
                </span>
                {game.arena && (
                  <span className="text-[9px] text-muted-foreground/40 mt-0.5">{game.arena}</span>
                )}
              </>
            )}
          </div>

          {/* Home team */}
          <div className="flex flex-col items-center min-w-[60px]">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">
              {homeInfo?.abbrev ?? game.home_team}
            </span>
            {!isScheduled && (
              <span className={cn("text-2xl font-bold tabular-nums leading-none mt-0.5",
                isFinal && game.home_score !== null && game.away_score !== null
                  ? game.home_score > game.away_score ? "text-green-400" : "text-muted-foreground/60"
                  : "text-foreground"
              )}>
                {game.home_score ?? "—"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quarter breakdown */}
      {(game.home_periods.length > 0 || game.away_periods.length > 0) && (
        <div className="px-3 py-1.5 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-1">
            <span className="w-12"></span>
            {game.home_periods.map((_, i) => (
              <span key={i} className="w-7 text-center">{i < 4 ? `Q${i + 1}` : `OT${i - 3}`}</span>
            ))}
            <span className="w-7 text-center ml-auto">TOT</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="w-12 text-muted-foreground/70">{awayInfo?.abbrev ?? game.away_team}</span>
            {game.away_periods.map((s, i) => (
              <span key={i} className="w-7 text-center text-foreground/80 tabular-nums">{s}</span>
            ))}
            <span className="w-7 text-center font-bold text-foreground ml-auto tabular-nums">
              {game.away_score ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] mt-0.5">
            <span className="w-12 text-muted-foreground/70">{homeInfo?.abbrev ?? game.home_team}</span>
            {game.home_periods.map((s, i) => (
              <span key={i} className="w-7 text-center text-foreground/80 tabular-nums">{s}</span>
            ))}
            <span className="w-7 text-center font-bold text-foreground ml-auto tabular-nums">
              {game.home_score ?? "—"}
            </span>
          </div>
        </div>
      )}

      {/* Content: top performers or injury report */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {(isLive || isFinal) && (game.home_top_performers.length > 0 || game.away_top_performers.length > 0) ? (
          <>
            {/* Column headers */}
            <div className="flex items-center px-2 py-1 border-b border-border/30 text-[9px] text-muted-foreground/50 uppercase tracking-wider">
              <span className="flex-1">Player</span>
              <span className="w-16 text-right">P/R/A</span>
              <span className="w-10 text-right">FG</span>
            </div>
            {/* Away performers */}
            {game.away_top_performers.length > 0 && (
              <>
                <div className="px-2 py-0.5 text-[9px] text-muted-foreground/50 uppercase tracking-wider bg-muted/10">
                  {awayInfo?.name ?? game.away_team}
                </div>
                {game.away_top_performers.map((p, i) => <PerformerRow key={i} p={p} />)}
              </>
            )}
            {/* Home performers */}
            {game.home_top_performers.length > 0 && (
              <>
                <div className="px-2 py-0.5 text-[9px] text-muted-foreground/50 uppercase tracking-wider bg-muted/10">
                  {homeInfo?.name ?? game.home_team}
                </div>
                {game.home_top_performers.map((p, i) => <PerformerRow key={i} p={p} />)}
              </>
            )}
          </>
        ) : game.injured_players.length > 0 ? (
          <>
            <div className="px-2 py-1 border-b border-border/30 text-[9px] text-muted-foreground/50 uppercase tracking-wider">
              Injury Report
            </div>
            {game.injured_players.map((p, i) => <InjuryRow key={i} p={p} />)}
          </>
        ) : (
          <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/40">
            {isScheduled
              ? "No injury report available"
              : isFinal && !game.is_today
              ? "No box score data for past games"
              : "No performer data"}
          </div>
        )}
      </div>
    </div>
  );
}
