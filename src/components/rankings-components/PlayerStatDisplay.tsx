"use client";

import { useState, useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  usePlayerStatsQuery,
  usePlayerStatsByNameQuery,
} from "@/hooks/usePlayer";
import type { PlayerStats, AvgStats } from "@/types/player";
import {
  calculateMovingAverage,
  calculateRecentFormTrend,
  type MovingAverageWindow,
} from "@/lib/chart-utils";
import { cn } from "@/lib/utils";

// Props for lookup by ID (used for rankings)
interface PlayerStatDisplayByIdProps {
  playerId: number;
  playerName?: never;
  playerTeam?: never;
}

// Props for lookup by name/team (used for roster)
interface PlayerStatDisplayByNameProps {
  playerId?: never;
  playerName: string;
  playerTeam?: string;
}

type PlayerStatDisplayProps =
  | PlayerStatDisplayByIdProps
  | PlayerStatDisplayByNameProps;

export default function PlayerStatDisplay(props: PlayerStatDisplayProps) {
  // Determine which lookup method to use
  const useIdLookup = "playerId" in props && props.playerId !== undefined;

  const idQuery = usePlayerStatsQuery(useIdLookup ? props.playerId : null);
  const nameQuery = usePlayerStatsByNameQuery(
    !useIdLookup && "playerName" in props ? props.playerName : null,
    !useIdLookup && "playerTeam" in props ? props.playerTeam : undefined
  );

  const { data: playerStats, isLoading } = useIdLookup ? idQuery : nameQuery;

  if (isLoading) {
    return <div>Loading player stats...</div>;
  }

  if (!playerStats) {
    return <div>No stats available for this player.</div>;
  }

  return (
    <div className="space-y-4">
      <PrimaryStatsGrid avgStats={playerStats.avg_stats} gameLogs={playerStats.game_logs} />
      <SecondaryStatsRow avgStats={playerStats.avg_stats} />
      <PlayerStatChart playerStats={playerStats} />
    </div>
  );
}

// Primary stats displayed prominently
function PrimaryStatsGrid({ avgStats, gameLogs }: { avgStats: AvgStats; gameLogs: PlayerStats["game_logs"] }) {
  const recentForm = calculateRecentFormTrend(gameLogs, avgStats.avg_fpts);

  const TrendIcon = recentForm.trend === "hot"
    ? TrendingUp
    : recentForm.trend === "cold"
    ? TrendingDown
    : Minus;

  const trendColor = recentForm.trend === "hot"
    ? "text-green-500"
    : recentForm.trend === "cold"
    ? "text-red-500"
    : "text-muted-foreground";

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      <div className="bg-secondary p-4 rounded shadow text-center">
        <h4 className="text-xs text-muted-foreground">FPTS</h4>
        <div className="flex items-center justify-center gap-1">
          <p className="text-xl font-bold">{avgStats.avg_fpts}</p>
          <TrendIcon className={cn("h-4 w-4", trendColor)} />
        </div>
        {recentForm.diff !== 0 && (
          <p className={cn("text-xs", trendColor)}>
            {recentForm.diff > 0 ? "+" : ""}{recentForm.diff} L5
          </p>
        )}
      </div>
      <StatCard label="PTS" value={avgStats.avg_points} />
      <StatCard label="REB" value={avgStats.avg_rebounds} />
      <StatCard label="AST" value={avgStats.avg_assists} />
      <StatCard label="STL" value={avgStats.avg_steals} />
      <StatCard label="BLK" value={avgStats.avg_blocks} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-secondary p-4 rounded shadow text-center">
      <h4 className="text-xs text-muted-foreground">{label}</h4>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

// Secondary stats displayed less prominently
function SecondaryStatsRow({ avgStats }: { avgStats: AvgStats }) {
  return (
    <div className="flex flex-wrap gap-4 justify-center text-sm">
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">FG%:</span>
        <span className="font-medium">{avgStats.avg_fg_pct}%</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">3PT%:</span>
        <span className="font-medium">{avgStats.avg_fg3_pct}%</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">FT%:</span>
        <span className="font-medium">{avgStats.avg_ft_pct}%</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">TOV:</span>
        <span className="font-medium">{avgStats.avg_turnovers}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">MIN:</span>
        <span className="font-medium">{avgStats.avg_minutes}</span>
      </div>
    </div>
  );
}

const chartConfig = {
  fpts: {
    label: "Fantasy Points",
    color: "hsl(var(--chart-1))",
  },
  movingAvg: {
    label: "Moving Avg",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

function PlayerStatChart({ playerStats }: { playerStats: PlayerStats }) {
  const [showMovingAverage, setShowMovingAverage] = useState(false);
  const [movingAverageWindow, setMovingAverageWindow] =
    useState<MovingAverageWindow>(5);
  const [showSeasonAverage, setShowSeasonAverage] = useState(false);

  const chartData = useMemo(() => {
    if (showMovingAverage) {
      return calculateMovingAverage(playerStats.game_logs, movingAverageWindow);
    }
    return playerStats.game_logs.map((log) => ({
      date: log.date,
      fpts: log.fpts,
    }));
  }, [playerStats.game_logs, showMovingAverage, movingAverageWindow]);

  const seasonAverage = playerStats.avg_stats.avg_fpts;

  return (
    <Card className="border-none">
      <CardHeader>
        <CardTitle>{playerStats.name}&apos;s Fantasy Scores</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Chart Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Switch
              id="moving-avg"
              checked={showMovingAverage}
              onCheckedChange={setShowMovingAverage}
            />
            <Label htmlFor="moving-avg" className="text-sm cursor-pointer">
              Moving Average
            </Label>
          </div>

          {showMovingAverage && (
            <Select
              value={movingAverageWindow.toString()}
              onValueChange={(v) =>
                setMovingAverageWindow(parseInt(v) as MovingAverageWindow)
              }
            >
              <SelectTrigger className="w-[110px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3-game</SelectItem>
                <SelectItem value="5">5-game</SelectItem>
                <SelectItem value="10">10-game</SelectItem>
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-2">
            <Switch
              id="season-avg"
              checked={showSeasonAverage}
              onCheckedChange={setShowSeasonAverage}
            />
            <Label htmlFor="season-avg" className="text-sm cursor-pointer">
              Season Average
            </Label>
          </div>
        </div>

        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 0,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickCount={3}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent />}
            />
            {(showMovingAverage || showSeasonAverage) && (
              <ChartLegend content={<ChartLegendContent />} />
            )}

            {/* Season average reference line */}
            {showSeasonAverage && (
              <ReferenceLine
                y={seasonAverage}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                label={{
                  value: `Avg: ${seasonAverage}`,
                  position: "insideTopRight",
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 12,
                }}
              />
            )}

            {/* Main FPTS line */}
            <Line
              dataKey="fpts"
              type="natural"
              stroke="var(--color-fpts)"
              strokeWidth={2}
              dot={{
                fill: "var(--color-fpts)",
              }}
              activeDot={{
                r: 6,
              }}
            />

            {/* Moving average line */}
            {showMovingAverage && (
              <Line
                dataKey="movingAvg"
                type="monotone"
                stroke="var(--color-movingAvg)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls
              />
            )}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
