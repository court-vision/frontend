"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useMatchupScoreHistoryQuery } from "@/hooks/useMatchup";
import type { MatchupScoreHistory } from "@/types/matchup";

interface MatchupScoreChartProps {
  teamId: number | null;
  matchupPeriod?: number;
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[200px] w-full" />
      </CardContent>
    </Card>
  );
}

function ChartContent({ data }: { data: MatchupScoreHistory }) {
  const chartConfig = useMemo(
    () =>
      ({
        your_score: {
          label: data.team_name,
          color: "hsl(var(--chart-1))",
        },
        opponent_score: {
          label: data.opponent_team_name,
          color: "hsl(var(--chart-4))",
        },
      }) satisfies ChartConfig,
    [data.team_name, data.opponent_team_name]
  );

  const chartData = useMemo(
    () =>
      data.history.map((point) => ({
        date: point.date,
        day: `Day ${point.day_of_matchup + 1}`,
        your_score: point.your_score,
        opponent_score: point.opponent_score,
      })),
    [data.history]
  );

  const latestYourScore = chartData[chartData.length - 1]?.your_score ?? 0;
  const latestOpponentScore =
    chartData[chartData.length - 1]?.opponent_score ?? 0;
  const isWinning = latestYourScore > latestOpponentScore;
  const scoreDiff = Math.abs(latestYourScore - latestOpponentScore).toFixed(1);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium tracking-tight">
            Score Progression
          </CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <span
              className={
                isWinning
                  ? "text-[hsl(var(--status-win))]"
                  : "text-[hsl(var(--status-loss))]"
              }
            >
              {isWinning ? "+" : "-"}
              {scoreDiff}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 0, right: 12, top: 12, bottom: 0 }}
          >
            <defs>
              <linearGradient id="yourScoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="hsl(var(--chart-1))"
                  stopOpacity={0.4}
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--chart-1))"
                  stopOpacity={0.05}
                />
              </linearGradient>
              <linearGradient
                id="opponentScoreGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="hsl(var(--chart-4))"
                  stopOpacity={0.4}
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--chart-4))"
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              className="stroke-muted"
            />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickCount={4}
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => Math.round(value).toString()}
            />
            <ChartTooltip
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    if (payload?.[0]?.payload?.date) {
                      const date = new Date(payload[0].payload.date);
                      return date.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      });
                    }
                    return "";
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              dataKey="your_score"
              type="monotone"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2.5}
              fill="url(#yourScoreGradient)"
              dot={{
                fill: "hsl(var(--chart-1))",
                strokeWidth: 0,
                r: 3,
              }}
              activeDot={{
                r: 5,
                strokeWidth: 2,
                stroke: "hsl(var(--background))",
              }}
            />
            <Area
              dataKey="opponent_score"
              type="monotone"
              stroke="hsl(var(--chart-4))"
              strokeWidth={2.5}
              fill="url(#opponentScoreGradient)"
              dot={{
                fill: "hsl(var(--chart-4))",
                strokeWidth: 0,
                r: 3,
              }}
              activeDot={{
                r: 5,
                strokeWidth: 2,
                stroke: "hsl(var(--background))",
              }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function MatchupScoreChart({
  teamId,
  matchupPeriod,
}: MatchupScoreChartProps) {
  const { data, isLoading, error } = useMatchupScoreHistoryQuery(
    teamId,
    matchupPeriod
  );

  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (error || !data || data.history.length === 0) {
    return null;
  }

  return <ChartContent data={data} />;
}
