"use client";

import { useMemo } from "react";
import { Activity, AlertCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useNBATeamLiveGameQuery } from "@/hooks/useNBATeam";
import { NBA_TEAM_BY_ABBREV } from "@/lib/nbaTeams";
import { Skeleton } from "@/components/ui/skeleton";
import type { TopPerformer, InjuredPlayer, GameScoreSnapshot } from "@/types/games";

// --- Helpers ---

function formatGameClock(clock: string | null): string {
  if (!clock) return "";
  const match = clock.match(/PT(\d+)M([\d.]+)S/);
  if (match) {
    const mins = parseInt(match[1], 10);
    const secs = Math.floor(parseFloat(match[2]));
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  return clock;
}

function shortenName(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

function toElapsed(period: number | null, clock: string | null): number {
  if (!period || !clock) return 0;
  const match = clock.match(/PT(\d+)M([\d.]+)S/);
  if (!match) return 0;
  const clockSec = parseInt(match[1]) * 60 + Math.floor(parseFloat(match[2]));
  const periodDuration = period <= 4 ? 720 : 300;
  const periodOffset =
    period <= 4 ? (period - 1) * 720 : 4 * 720 + (period - 5) * 300;
  return periodOffset + (periodDuration - clockSec);
}

// --- Sub-components ---

function LiveBadge({ period, gameClock }: { period: number | null; gameClock: string | null }) {
  const clock = formatGameClock(gameClock);
  const periodLabel = period && period > 4 ? `OT${period - 4}` : period ? `Q${period}` : "Q?";
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-emerald-400 font-bold text-[10px] tracking-widest">LIVE</span>
      {period && (
        <span className="text-foreground/60 text-[10px] font-mono">
          {periodLabel} {clock}
        </span>
      )}
    </div>
  );
}

interface ChartPoint { elapsed: number; home: number; away: number }
const QUARTER_TICKS = [0, 720, 1440, 2160, 2880];
const QUARTER_LABELS: Record<number, string> = { 0: "Q1", 720: "Q2", 1440: "Q3", 2160: "Q4", 2880: "" };

function ScoreChart({
  snapshots,
  homeTeam,
  awayTeam,
}: {
  snapshots: GameScoreSnapshot[];
  homeTeam: string;
  awayTeam: string;
}) {
  const chartData = useMemo<ChartPoint[]>(() => {
    return snapshots.map((s) => ({
      elapsed: toElapsed(s.period, s.game_clock),
      home: s.home_score,
      away: s.away_score,
    }));
  }, [snapshots]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[100px] text-[10px] text-muted-foreground/40 font-mono uppercase tracking-wider">
        Waiting for tip-off
      </div>
    );
  }

  const maxElapsed = Math.max(...chartData.map((d) => d.elapsed), 2880);
  const allTicks = QUARTER_TICKS.filter((t) => t <= maxElapsed + 300);

  return (
    <div className="px-1 pb-1">
      <ResponsiveContainer width="100%" height={95}>
        <LineChart data={chartData} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
          {[720, 1440, 2160, 2880].map((t) => (
            <ReferenceLine key={t} x={t} stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray="2 2" />
          ))}
          <XAxis
            dataKey="elapsed"
            type="number"
            domain={[0, maxElapsed]}
            ticks={allTicks}
            tickFormatter={(v) => QUARTER_LABELS[v] ?? ""}
            tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))", fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as ChartPoint;
              return (
                <div className="bg-background border border-border rounded px-2 py-1 text-[9px] font-mono">
                  <span className="text-primary">{homeTeam} {d.home}</span>
                  <span className="text-muted-foreground mx-1.5">·</span>
                  <span className="text-muted-foreground">{awayTeam} {d.away}</span>
                </div>
              );
            }}
          />
          <Line dataKey="home" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line dataKey="away" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex items-center gap-3 px-2 pb-0.5">
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-primary rounded-full" />
          <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">{homeTeam}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-muted-foreground rounded-full" />
          <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">{awayTeam}</span>
        </div>
      </div>
    </div>
  );
}

function BoxScoreRow({ p }: { p: TopPerformer }) {
  const fgStr = p.fga > 0 ? `${p.fgm}/${p.fga}` : "";
  return (
    <div className="flex items-center gap-1 px-2 py-[3px] border-b border-border/15 text-[10px] font-mono hover:bg-primary/5 transition-colors group">
      <span className="flex-1 min-w-0 truncate text-foreground/75 group-hover:text-foreground/90 transition-colors">
        {shortenName(p.name)}
      </span>
      <span className="shrink-0 w-5 text-right text-muted-foreground/40 tabular-nums">{p.min}</span>
      <span className="shrink-0 w-6 text-right text-primary font-semibold tabular-nums">{p.pts}</span>
      <span className="shrink-0 w-5 text-right text-sky-400/80 tabular-nums">{p.reb}</span>
      <span className="shrink-0 w-5 text-right text-emerald-400/80 tabular-nums">{p.ast}</span>
      {fgStr && (
        <span className="shrink-0 w-8 text-right text-muted-foreground/40 tabular-nums text-[9px]">{fgStr}</span>
      )}
    </div>
  );
}

function InjuryRow({ p }: { p: InjuredPlayer }) {
  const badgeStyle =
    p.status === "Out" || p.status === "Doubtful"
      ? "bg-red-500/15 text-red-400 border-red-500/25"
      : "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border/20 text-[10px] font-mono">
      <span className="flex-1 min-w-0 truncate text-foreground/75">{p.name}</span>
      <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-bold border shrink-0", badgeStyle)}>
        {p.status === "Questionable" ? "GTD" : p.status === "Out" ? "OUT" : p.status === "Doubtful" ? "DOUBT" : p.status.toUpperCase()}
      </span>
      {p.injury_type && (
        <span className="text-muted-foreground/40 shrink-0 truncate max-w-[72px] text-[9px]">{p.injury_type}</span>
      )}
    </div>
  );
}

// --- Main panel ---

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
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[110px] w-full" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-32 w-full" />
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
  const hasPerformers = game.home_top_performers.length > 0 || game.away_top_performers.length > 0;
  const showChart = isLive || isFinal || game.score_history.length > 0;

  // Win/loss coloring for final scores
  const homeWon = isFinal && game.home_score !== null && game.away_score !== null && game.home_score > game.away_score;
  const awayWon = isFinal && game.home_score !== null && game.away_score !== null && game.away_score > game.home_score;

  return (
    <div className="flex flex-col h-full overflow-hidden font-mono">

      {/* ── Score Header ─────────────────────────────────────── */}
      <div className="px-3 pt-2.5 pb-2 border-b border-border/50 shrink-0">
        <div className="flex items-center justify-between gap-3">

          {/* Away */}
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/40 mb-0.5 truncate max-w-[90px]">
              {awayInfo?.name.split(" ").slice(0, -1).join(" ") ?? game.away_team}
            </span>
            <span className={cn(
              "text-xl font-black tracking-tight leading-none",
              awayWon ? "text-foreground" : isFinal ? "text-muted-foreground/40" : "text-foreground/90"
            )}>
              {awayInfo?.abbrev ?? game.away_team}
            </span>
            {!isScheduled && (
              <span className={cn(
                "text-2xl font-black tabular-nums leading-none mt-1",
                awayWon ? "text-foreground" : isFinal ? "text-muted-foreground/35" : "text-foreground"
              )}>
                {game.away_score ?? "—"}
              </span>
            )}
          </div>

          {/* Center: status */}
          <div className="flex flex-col items-center shrink-0 gap-1">
            {isLive ? (
              <LiveBadge period={game.period} gameClock={game.game_clock} />
            ) : isFinal ? (
              <span className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground/70 uppercase">Final</span>
            ) : (
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40">vs</span>
            )}
            {isScheduled && game.start_time_et && (
              <span className="text-[11px] font-bold text-primary tabular-nums">{game.start_time_et} <span className="text-[9px] font-normal text-muted-foreground/50">ET</span></span>
            )}
            {isScheduled && !game.is_today && (
              <span className="text-[9px] text-muted-foreground/50">
                {new Date(game.game_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
            )}
            {game.arena && (
              <span className="text-[8px] text-muted-foreground/30 text-center leading-tight max-w-[70px] truncate">{game.arena}</span>
            )}
          </div>

          {/* Home */}
          <div className="flex flex-col items-end min-w-0">
            <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/40 mb-0.5 truncate max-w-[90px]">
              {homeInfo?.name.split(" ").slice(0, -1).join(" ") ?? game.home_team}
            </span>
            <span className={cn(
              "text-xl font-black tracking-tight leading-none",
              homeWon ? "text-foreground" : isFinal ? "text-muted-foreground/40" : "text-foreground/90"
            )}>
              {homeInfo?.abbrev ?? game.home_team}
            </span>
            {!isScheduled && (
              <span className={cn(
                "text-2xl font-black tabular-nums leading-none mt-1",
                homeWon ? "text-primary" : isFinal ? "text-muted-foreground/35" : "text-foreground"
              )}>
                {game.home_score ?? "—"}
              </span>
            )}
          </div>

        </div>
      </div>

      {/* ── Score Timeline Chart ──────────────────────────────── */}
      {showChart && (
        <div className="border-b border-border/30 shrink-0">
          <ScoreChart
            snapshots={game.score_history}
            homeTeam={homeInfo?.abbrev ?? game.home_team}
            awayTeam={awayInfo?.abbrev ?? game.away_team}
          />
        </div>
      )}

      {/* ── Quarter Breakdown ────────────────────────────────── */}
      {(game.home_periods.length > 0 || game.away_periods.length > 0) && (
        <div className="px-3 py-1.5 border-b border-border/25 shrink-0">
          <div className="flex items-center gap-1 text-[8px] text-muted-foreground/40 uppercase tracking-wider mb-1">
            <span className="w-8" />
            {game.home_periods.map((_, i) => (
              <span key={i} className="w-6 text-center">{i < 4 ? `Q${i + 1}` : `OT${i - 3}`}</span>
            ))}
            <span className="w-7 text-center ml-auto font-semibold">TOT</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="w-8 text-muted-foreground/60">{awayInfo?.abbrev ?? game.away_team}</span>
            {game.away_periods.map((s, i) => (
              <span key={i} className="w-6 text-center text-foreground/60 tabular-nums">{s}</span>
            ))}
            <span className={cn("w-7 text-center font-bold ml-auto tabular-nums", awayWon ? "text-foreground" : "text-foreground/60")}>
              {game.away_score ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] mt-0.5">
            <span className="w-8 text-muted-foreground/60">{homeInfo?.abbrev ?? game.home_team}</span>
            {game.home_periods.map((s, i) => (
              <span key={i} className="w-6 text-center text-foreground/60 tabular-nums">{s}</span>
            ))}
            <span className={cn("w-7 text-center font-bold ml-auto tabular-nums", homeWon ? "text-primary" : "text-foreground/60")}>
              {game.home_score ?? "—"}
            </span>
          </div>
        </div>
      )}

      {/* ── Box Score / Injury Content ────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {(isLive || isFinal) && hasPerformers ? (
          <div className="h-full grid grid-cols-2 divide-x divide-border/25">

            {/* Away column */}
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between px-2 py-1 bg-muted/20 border-b border-border/25 shrink-0">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                  {awayInfo?.abbrev ?? game.away_team}
                </span>
                {isLive && (
                  <span className="text-[8px] text-emerald-500/70 uppercase tracking-wider">live</span>
                )}
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 border-b border-border/20 text-[8px] text-muted-foreground/35 uppercase tracking-wider">
                <span className="flex-1">Player</span>
                <span className="w-5 text-right">M</span>
                <span className="w-6 text-right text-primary/50">P</span>
                <span className="w-5 text-right text-sky-400/50">R</span>
                <span className="w-5 text-right text-emerald-400/50">A</span>
                <span className="w-8 text-right">FG</span>
              </div>
              <div className="overflow-y-auto flex-1">
                {game.away_top_performers.map((p, i) => <BoxScoreRow key={i} p={p} />)}
                {game.away_top_performers.length === 0 && (
                  <div className="flex items-center justify-center h-10 text-[10px] text-muted-foreground/30">
                    No data
                  </div>
                )}
              </div>
            </div>

            {/* Home column */}
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between px-2 py-1 bg-muted/20 border-b border-border/25 shrink-0">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                  {homeInfo?.abbrev ?? game.home_team}
                </span>
                {isLive && (
                  <span className="text-[8px] text-emerald-500/70 uppercase tracking-wider">live</span>
                )}
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 border-b border-border/20 text-[8px] text-muted-foreground/35 uppercase tracking-wider">
                <span className="flex-1">Player</span>
                <span className="w-5 text-right">M</span>
                <span className="w-6 text-right text-primary/50">P</span>
                <span className="w-5 text-right text-sky-400/50">R</span>
                <span className="w-5 text-right text-emerald-400/50">A</span>
                <span className="w-8 text-right">FG</span>
              </div>
              <div className="overflow-y-auto flex-1">
                {game.home_top_performers.map((p, i) => <BoxScoreRow key={i} p={p} />)}
                {game.home_top_performers.length === 0 && (
                  <div className="flex items-center justify-center h-10 text-[10px] text-muted-foreground/30">
                    No data
                  </div>
                )}
              </div>
            </div>

          </div>
        ) : game.injured_players.length > 0 ? (
          <div className="overflow-y-auto h-full">
            <div className="px-2 py-1 border-b border-border/30 text-[9px] text-muted-foreground/40 uppercase tracking-wider bg-muted/10">
              Injury Report
            </div>
            {game.injured_players.map((p, i) => <InjuryRow key={i} p={p} />)}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground/30">
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
