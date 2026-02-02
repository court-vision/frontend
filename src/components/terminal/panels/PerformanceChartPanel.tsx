"use client";

import { useState, useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import { LineChart as LineChartIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { usePlayerStatsQuery } from "@/hooks/usePlayer";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  calculateMovingAverage,
  type MovingAverageWindow,
} from "@/lib/chart-utils";

const chartConfig = {
  fpts: {
    label: "FPTS",
    color: "hsl(var(--primary))",
  },
  movingAvg: {
    label: "Moving Avg",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function PerformanceChartPanel() {
  const { focusedPlayerId, statWindow } = useTerminalStore();
  const { data: playerStats, isLoading, error } = usePlayerStatsQuery(
    focusedPlayerId,
    "nba"
  );

  const [showMovingAvg, setShowMovingAvg] = useState(true);
  const [movingAvgWindow, setMovingAvgWindow] = useState<MovingAverageWindow>(5);
  const [showSeasonAvg, setShowSeasonAvg] = useState(true);

  // Process chart data
  const chartData = useMemo(() => {
    if (!playerStats?.game_logs) return [];

    let logs = playerStats.game_logs;

    // Filter by stat window
    if (statWindow === "l5") {
      logs = logs.slice(-5);
    } else if (statWindow === "l10") {
      logs = logs.slice(-10);
    } else if (statWindow === "l20") {
      logs = logs.slice(-20);
    }

    if (showMovingAvg) {
      return calculateMovingAverage(logs, movingAvgWindow);
    }

    return logs.map((log) => ({
      date: log.date,
      fpts: log.fpts,
    }));
  }, [playerStats?.game_logs, statWindow, showMovingAvg, movingAvgWindow]);

  const seasonAvg = playerStats?.avg_stats?.avg_fpts ?? 0;

  if (!focusedPlayerId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <LineChartIcon className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No player selected</p>
      </div>
    );
  }

  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (error || !playerStats) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="text-sm text-destructive">Failed to load chart data</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-3">
      {/* Chart Controls */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
          {([3, 5, 10] as MovingAverageWindow[]).map((w) => (
            <Button
              key={w}
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 px-2 text-xs font-mono",
                movingAvgWindow === w && showMovingAvg && "bg-background shadow-sm"
              )}
              onClick={() => {
                setMovingAvgWindow(w);
                setShowMovingAvg(true);
              }}
            >
              {w}MA
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-2 text-xs",
            showSeasonAvg && "bg-muted"
          )}
          onClick={() => setShowSeasonAvg(!showSeasonAvg)}
        >
          Avg
        </Button>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <AreaChart
            data={chartData}
            margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id="fptsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              width={35}
              domain={["auto", "auto"]}
            />
            <ChartTooltip
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <span className="font-mono">
                      {name === "fpts" ? "FPTS" : "MA"}: {Number(value).toFixed(1)}
                    </span>
                  )}
                />
              }
            />

            {/* Season average reference line */}
            {showSeasonAvg && (
              <ReferenceLine
                y={seasonAvg}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.7}
              />
            )}

            {/* FPTS Area */}
            <Area
              type="monotone"
              dataKey="fpts"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#fptsGradient)"
              dot={chartData.length <= 20}
              activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
            />

            {/* Moving Average Line */}
            {showMovingAvg && (
              <Line
                type="monotone"
                dataKey="movingAvg"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls
              />
            )}
          </AreaChart>
        </ChartContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-primary rounded" />
          <span>FPTS</span>
        </div>
        {showMovingAvg && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-chart-2 rounded" style={{ borderStyle: "dashed" }} />
            <span>{movingAvgWindow}MA</span>
          </div>
        )}
        {showSeasonAvg && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-px bg-muted-foreground" style={{ borderTop: "1px dashed" }} />
            <span>Avg: {seasonAvg.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex flex-col h-full p-3">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-12" />
      </div>
      <Skeleton className="flex-1 w-full" />
    </div>
  );
}
