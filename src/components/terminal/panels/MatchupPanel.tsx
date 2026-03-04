"use client";

import { useState, useMemo } from "react";
import { Swords, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { useTerminalStore } from "@/stores/useTerminalStore";
import {
  useLiveMatchupQuery,
  useMatchupScoreHistoryQuery,
  matchupKeys,
} from "@/hooks/useMatchup";
import { useTeamInsightsQuery } from "@/hooks/useTeams";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  LiveMatchupPlayer,
  LiveMatchupTeam,
  DailyMatchupFuturePlayer,
  DailyMatchupPlayerStats,
} from "@/types/matchup";
import type { SlimGene } from "@/types/lineup";

const BENCH_SLOTS = new Set(["BE", "IR"]);

// --- Shared sub-components (kept from original) ---

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-red-500 uppercase leading-none">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
      </span>
      LIVE
    </span>
  );
}

function PlayerRow({ player }: { player: LiveMatchupPlayer }) {
  const isLive = player.live?.game_status === 2;
  const isFinal = player.live?.game_status === 3;
  const liveFpts = player.live?.live_fpts;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/20 hover:bg-muted/30 transition-colors">
      <span className="shrink-0 w-7 text-[9px] font-mono text-muted-foreground uppercase text-center">
        {player.lineup_slot}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-medium truncate block leading-none mb-0.5">
          {player.name}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-muted-foreground uppercase">
            {player.team}
          </span>
          {isLive && <LiveBadge />}
          {isFinal && (
            <span className="text-[9px] font-mono text-muted-foreground/50 uppercase">
              Final
            </span>
          )}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 text-[9px] font-mono tabular-nums px-1 py-0.5 rounded-sm leading-none",
          player.games_remaining > 0
            ? "text-blue-400 bg-blue-400/10"
            : "text-muted-foreground/40 bg-muted/30"
        )}
      >
        {player.games_remaining}G
      </span>
      <div className="shrink-0 text-right w-14">
        {isLive && liveFpts !== undefined && liveFpts !== null ? (
          <span className="font-mono text-xs font-bold tabular-nums text-amber-400">
            {liveFpts.toFixed(1)}
          </span>
        ) : (
          <span className="font-mono text-xs tabular-nums text-foreground">
            {player.avg_points.toFixed(1)}
          </span>
        )}
        <div className="text-[9px] font-mono text-muted-foreground/60 tabular-nums">
          {player.projected_points.toFixed(1)} proj
        </div>
      </div>
    </div>
  );
}

function TeamRosterList({ team, showBench }: { team: LiveMatchupTeam; showBench: boolean }) {
  const starters = team.roster.filter((p) => !BENCH_SLOTS.has(p.lineup_slot));
  const bench = team.roster.filter((p) => BENCH_SLOTS.has(p.lineup_slot));
  const displayed = showBench ? team.roster : starters;

  if (displayed.length === 0) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-[10px] text-muted-foreground">No players</p>
      </div>
    );
  }

  return (
    <div>
      {(showBench ? starters : displayed).map((p) => (
        <PlayerRow key={p.player_id} player={p} />
      ))}
      {showBench && bench.length > 0 && (
        <>
          <div className="px-3 py-0.5 bg-muted/20 border-b border-border/20">
            <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              Bench
            </span>
          </div>
          {bench.map((p) => (
            <PlayerRow key={p.player_id} player={p} />
          ))}
        </>
      )}
    </div>
  );
}

// --- Chart data types ---

interface MatchupChartPoint {
  day: number;
  dayLabel: string;
  differential: number | null;
  yourPlayers: number;
  oppPlayers: number; // negative for downward bars
}

interface ChartTooltipPayload {
  name: string;
  value: number | null;
  color: string;
  dataKey: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const diff = payload.find((p) => p.dataKey === "differential");
  const yours = payload.find((p) => p.dataKey === "yourPlayers");
  const opp = payload.find((p) => p.dataKey === "oppPlayers");

  return (
    <div className="bg-background border border-border/60 px-2 py-1 text-[10px] font-mono shadow-md">
      <div className="text-muted-foreground mb-0.5">{label}</div>
      {diff?.value != null && (
        <div className={cn(diff.value >= 0 ? "text-emerald-500" : "text-destructive")}>
          {diff.value >= 0 ? "+" : ""}{diff.value.toFixed(1)} diff
        </div>
      )}
      {yours?.value != null && (
        <div className="text-primary/80">{yours.value} playing</div>
      )}
      {opp?.value != null && (
        <div className="text-destructive/80">{Math.abs(opp.value)} opp playing</div>
      )}
    </div>
  );
}

// --- Helpers ---

function countActivePlayersFromGene(gene: SlimGene): number {
  return Object.entries(gene.Roster).filter(
    ([slot]) => !BENCH_SLOTS.has(slot) && slot !== "IR"
  ).length;
}

function countPlayersWithGames(
  roster: (DailyMatchupPlayerStats | DailyMatchupFuturePlayer)[]
): number {
  return roster.filter((p) => {
    if ("has_game" in p) return p.has_game; // future
    return p.had_game; // past
  }).length;
}

// --- Main panel ---

export function MatchupPanel() {
  const { focusedTeamId, generatedLineup } = useTerminalStore();
  const { getToken, isSignedIn } = useAuth();
  const { data: liveData, isLoading: liveLoading, error: liveError } =
    useLiveMatchupQuery(focusedTeamId);
  const { data: historyData } = useMatchupScoreHistoryQuery(focusedTeamId);
  const { data: insightsData } = useTeamInsightsQuery(focusedTeamId);

  const [activeTab, setActiveTab] = useState<"my_team" | "opponent">("my_team");
  const [showBench, setShowBench] = useState(false);
  const [simulating, setSimulating] = useState(false);

  // Generate all dates in the matchup period from schedule overview
  const matchupDates = useMemo(() => {
    const schedule = insightsData?.schedule_overview;
    if (!schedule) return [];
    const start = new Date(schedule.matchup_start + "T00:00:00");
    const end = new Date(schedule.matchup_end + "T00:00:00");
    const dates: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  }, [insightsData]);

  // Fetch daily matchup data for ALL dates to get accurate player counts
  const dailyQueries = useQueries({
    queries: matchupDates.map((date) => ({
      queryKey: matchupKeys.daily(focusedTeamId!, date),
      queryFn: () => apiClient.getDailyMatchup(getToken, focusedTeamId!, date),
      enabled: !!focusedTeamId && isSignedIn === true,
      staleTime: 1000 * 60 * 10,
    })),
  });

  // Build a date→dailyResult lookup for chart building
  const dailyByDate = useMemo(() => {
    const map = new Map<string, (typeof dailyQueries)[number]>();
    matchupDates.forEach((date, i) => {
      map.set(date, dailyQueries[i]);
    });
    return map;
  }, [matchupDates, dailyQueries]);

  // Build chart data from actual daily matchup responses
  const chartData = useMemo(() => {
    if (!historyData || !insightsData?.schedule_overview) return [];

    const schedule = insightsData.schedule_overview;
    const history = historyData.history ?? [];
    const currentDayIndex = schedule.current_day_index;
    const totalDays = schedule.day_game_counts.length;

    const points: MatchupChartPoint[] = [];

    for (let i = 0; i < totalDays; i++) {
      const historyPoint = history.find((h) => h.day_of_matchup === i);
      const isPastOrCurrent = i <= currentDayIndex;

      // Score differential: only for past/current days with data
      let differential: number | null = null;
      if (isPastOrCurrent && historyPoint) {
        differential = historyPoint.your_score - historyPoint.opponent_score;
      }

      // Player counts from daily matchup queries (accurate per-day data)
      let yourPlayers = 0;
      let oppPlayers = 0;
      const date = matchupDates[i];
      const dailyResult = date ? dailyByDate.get(date) : undefined;
      if (dailyResult?.data) {
        const day = dailyResult.data;
        yourPlayers = countPlayersWithGames(day.your_team.roster);
        oppPlayers = countPlayersWithGames(day.opponent_team.roster);
      } else {
        // Fallback to schedule overview for your team if daily not loaded yet
        yourPlayers = schedule.day_game_counts[i] ?? 0;
      }

      // Apply lineup simulation for future days
      if (simulating && generatedLineup && i > currentDayIndex) {
        const gene = generatedLineup.Lineup.find((g) => g.Day === i);
        if (gene) {
          yourPlayers = countActivePlayersFromGene(gene);
        }
      }

      points.push({
        day: i,
        dayLabel: `D${i + 1}`,
        differential,
        yourPlayers,
        oppPlayers: -oppPlayers, // negative for downward bars
      });
    }

    return points;
  }, [historyData, insightsData, matchupDates, dailyByDate, simulating, generatedLineup]);

  // Compute symmetric domains so both axes share 0 at the same visual position
  const playerAxisDomain = useMemo(() => {
    if (chartData.length === 0) return [-1, 1] as [number, number];
    const maxUp = Math.max(...chartData.map((d) => d.yourPlayers), 1);
    const maxDown = Math.max(...chartData.map((d) => Math.abs(d.oppPlayers)), 1);
    const bound = Math.max(maxUp, maxDown);
    return [-bound, bound] as [number, number];
  }, [chartData]);

  const diffAxisDomain = useMemo(() => {
    if (chartData.length === 0) return [-1, 1] as [number, number];
    const diffs = chartData
      .map((d) => d.differential)
      .filter((d): d is number => d !== null);
    if (diffs.length === 0) return [-1, 1] as [number, number];
    const absMax = Math.max(...diffs.map(Math.abs), 1);
    return [-absMax, absMax] as [number, number];
  }, [chartData]);

  // Compute simulated projected improvement
  const simProjectedDelta = useMemo(() => {
    if (!simulating || !generatedLineup) return null;
    return generatedLineup.Improvement;
  }, [simulating, generatedLineup]);

  if (!focusedTeamId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <Swords className="h-7 w-7 text-muted-foreground/25" />
        <p className="text-[10px] text-muted-foreground">No team selected</p>
        <p className="text-[9px] text-muted-foreground/60">
          Select a team to view matchup
        </p>
      </div>
    );
  }

  if (liveLoading) {
    return (
      <div className="flex flex-col h-full p-2 gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-6 w-full" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (liveError || !liveData) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <p className="text-[10px] text-destructive">Failed to load matchup</p>
      </div>
    );
  }

  const yourTeam = liveData.your_team;
  const opponentTeam = liveData.opponent_team;
  const yourScore = yourTeam.current_score;
  const oppScore = opponentTeam.current_score;
  const yourLeading = yourScore > oppScore;
  const margin = Math.abs(liveData.projected_margin);
  const projWinnerIsYou = liveData.projected_winner === yourTeam.team_name;
  const showProjectedBadge = margin > 5;
  const activeTeam = activeTab === "my_team" ? yourTeam : opponentTeam;

  const canSimulate = generatedLineup !== null;

  // Projected scores (with simulation delta)
  const displayedYourProj = simProjectedDelta != null
    ? yourTeam.projected_score + simProjectedDelta
    : yourTeam.projected_score;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scoreboard header */}
      <div className="shrink-0 px-3 py-2 border-b border-border/40 bg-muted/10">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider truncate max-w-[90px]">
              {yourTeam.team_name}
            </span>
            <span
              className={cn(
                "font-mono text-xl font-bold tabular-nums leading-none",
                yourLeading ? "text-foreground" : "text-muted-foreground/70"
              )}
            >
              {yourScore.toFixed(1)}
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[9px] font-mono text-muted-foreground/50">vs</span>
            {showProjectedBadge && (
              <span
                className={cn(
                  "text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm leading-none",
                  projWinnerIsYou
                    ? "text-green-500 bg-green-500/10"
                    : "text-red-500 bg-red-500/10"
                )}
              >
                {projWinnerIsYou ? "WIN +" : "LOSS -"}
                {margin.toFixed(1)}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider truncate max-w-[90px]">
              {opponentTeam.team_name}
            </span>
            <span
              className={cn(
                "font-mono text-xl font-bold tabular-nums leading-none",
                !yourLeading ? "text-foreground" : "text-muted-foreground/70"
              )}
            >
              {oppScore.toFixed(1)}
            </span>
          </div>
        </div>
        <div className="mt-1 text-[9px] font-mono text-muted-foreground/50 text-center">
          Week {liveData.matchup_period} &middot; {liveData.matchup_period_start}{" "}
          &ndash; {liveData.matchup_period_end}
        </div>
      </div>

      {/* Combined chart */}
      {chartData.length > 0 && (
        <div className="shrink-0 border-b border-border/40">
          <div className="px-1 py-2 h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
              >
                <XAxis
                  dataKey="dayLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fontSize: 9,
                    fill: "hsl(var(--muted-foreground))",
                    fontFamily: "monospace",
                  }}
                  interval={0}
                />
                {/* Left axis: score differential (symmetric so 0 is centered) */}
                <YAxis
                  yAxisId="diff"
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fontSize: 9,
                    fill: "hsl(var(--muted-foreground))",
                    fontFamily: "monospace",
                  }}
                  width={28}
                  domain={diffAxisDomain}
                />
                {/* Right axis: player counts (hidden, just for scale) */}
                <YAxis
                  yAxisId="players"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tick={false}
                  width={4}
                  domain={playerAxisDomain}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                />
                <ReferenceLine
                  yAxisId="diff"
                  y={0}
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                  strokeOpacity={0.6}
                />
                <Bar
                  yAxisId="players"
                  dataKey="yourPlayers"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.25}
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="players"
                  dataKey="oppPlayers"
                  fill="hsl(var(--destructive))"
                  fillOpacity={0.25}
                  radius={[0, 0, 2, 2]}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="diff"
                  type="monotone"
                  dataKey="differential"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                  activeDot={{ r: 3.5 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Simulate button */}
          {canSimulate && (
            <div className="px-3 pb-1.5 flex items-center justify-end">
              <Button
                variant={simulating ? "secondary" : "outline"}
                size="sm"
                className="h-5 px-2 text-[9px] font-mono gap-1"
                onClick={() => setSimulating((v) => !v)}
              >
                <Zap className="h-2.5 w-2.5" />
                {simulating ? "Clear Sim" : "Simulate Lineup"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Tab bar + bench toggle */}
      <div className="shrink-0 flex items-center border-b border-border/30 bg-muted/5">
        <button
          className={cn(
            "flex-1 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors",
            activeTab === "my_team"
              ? "text-primary border-b-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
          onClick={() => setActiveTab("my_team")}
        >
          My Team
        </button>
        <button
          className={cn(
            "flex-1 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors",
            activeTab === "opponent"
              ? "text-primary border-b-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
          onClick={() => setActiveTab("opponent")}
        >
          Opponent
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[9px] font-mono text-muted-foreground rounded-none border-l border-border/30"
          onClick={() => setShowBench((v) => !v)}
        >
          {showBench ? (
            <>
              <ChevronUp className="h-2.5 w-2.5 mr-1" />
              Hide Bench
            </>
          ) : (
            <>
              <ChevronDown className="h-2.5 w-2.5 mr-1" />
              Bench
            </>
          )}
        </Button>
      </div>

      {/* Column headers */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-0.5 border-b border-border/20 bg-muted/10">
        <span className="w-7 text-[9px] text-muted-foreground uppercase tracking-wider text-center">
          Slot
        </span>
        <span className="flex-1 text-[9px] text-muted-foreground uppercase tracking-wider">
          Player
        </span>
        <span className="w-6 text-[9px] text-muted-foreground uppercase tracking-wider text-center">
          G
        </span>
        <span className="w-14 text-[9px] text-muted-foreground uppercase tracking-wider text-right">
          FPTS
        </span>
      </div>

      {/* Player list */}
      <div className="flex-1 overflow-y-auto">
        <TeamRosterList team={activeTeam} showBench={showBench} />
      </div>

      {/* Footer: projected scores */}
      <div className="shrink-0 border-t border-border/30 px-3 py-1 flex items-center justify-between bg-muted/10">
        <span className="text-[9px] font-mono text-muted-foreground/60">
          Projected
          {simulating && (
            <span className="ml-1 text-amber-400 font-semibold">SIM</span>
          )}
        </span>
        <span className="text-[9px] font-mono tabular-nums text-muted-foreground">
          {displayedYourProj.toFixed(1)}{" "}
          <span className="text-muted-foreground/40">vs</span>{" "}
          {opponentTeam.projected_score.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
