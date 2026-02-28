"use client";

import { useMemo } from "react";
import { Area, ComposedChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
  liveScore?: { your_score: number; opponent_score: number };
  selectedDate?: string | null;
  todayDate?: string;
  matchupPeriodEnd?: string;
  yourProjectedScore?: number;
  oppProjectedScore?: number;
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

// Returns days between two ISO date strings (inclusive), as ISO strings
function getDaysBetween(startIso: string, endIso: string): string[] {
  const days: string[] = [];
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  while (cur <= end) {
    days.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`
    );
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function asFiniteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

interface ChartPoint {
  date: string;
  day: string;
  your_score: number | null;
  opponent_score: number | null;
  isLive: boolean;
  isProjected: boolean;
}

interface ChartContentProps {
  data: MatchupScoreHistory;
  liveScore?: { your_score: number; opponent_score: number };
  selectedDate?: string | null;
  todayDate?: string;
  matchupPeriodEnd?: string;
  yourProjectedScore?: number;
  oppProjectedScore?: number;
}

function ChartContent({
  data,
  liveScore,
  selectedDate,
  todayDate,
  matchupPeriodEnd,
  yourProjectedScore,
  oppProjectedScore,
}: ChartContentProps) {
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

  const { chartData, mode } = useMemo(() => {
    // Build base historical points
    const basePoints: ChartPoint[] = data.history.map((point) => ({
      date: point.date,
      day: `Day ${point.day_of_matchup + 1}`,
      your_score: point.your_score,
      opponent_score: point.opponent_score,
      isLive: false,
      isProjected: false,
    }));

    const today = todayDate ?? (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    })();

    // ── WEEK VIEW (no date selected): existing behavior + live overlay ──────
    if (!selectedDate || selectedDate === today) {
      if (!liveScore) return { chartData: basePoints, mode: "week" as const };

      const lastPoint = basePoints[basePoints.length - 1];
      const liveChanged =
        Math.abs(liveScore.your_score - (lastPoint?.your_score ?? 0)) > 0.05 ||
        Math.abs(liveScore.opponent_score - (lastPoint?.opponent_score ?? 0)) > 0.05;

      if (!liveChanged) return { chartData: basePoints, mode: "week" as const };

      return {
        chartData: [
          ...basePoints,
          {
            date: today,
            day: "Live",
            your_score: liveScore.your_score,
            opponent_score: liveScore.opponent_score,
            isLive: true,
            isProjected: false,
          },
        ],
        mode: "week" as const,
      };
    }

    // ── PAST DAY: filter points up to selectedDate ───────────────────────────
    if (selectedDate < today) {
      const filtered = basePoints.filter((p) => p.date <= selectedDate);
      return { chartData: filtered.length > 0 ? filtered : basePoints, mode: "past" as const };
    }

    // ── FUTURE DAY: historical points + projected points in same series ──────
    const lastActual = basePoints[basePoints.length - 1];
    if (!lastActual || !matchupPeriodEnd) {
      return { chartData: basePoints, mode: "future" as const };
    }

    const projectionEnd = selectedDate > matchupPeriodEnd ? matchupPeriodEnd : selectedDate;
    const lastActualYour = lastActual.your_score ?? 0;
    const lastActualOpp = lastActual.opponent_score ?? 0;
    const yourProjectionTarget = asFiniteNumber(yourProjectedScore) ?? lastActualYour;
    const oppProjectionTarget = asFiniteNumber(oppProjectedScore) ?? lastActualOpp;

    if (projectionEnd <= lastActual.date) {
      return { chartData: basePoints, mode: "future" as const };
    }

    const lastActualDay = data.history[data.history.length - 1]?.day_of_matchup ?? (data.history.length - 1);

    // Days remaining from lastActual.date to matchupPeriodEnd
    const remainingDays = getDaysBetween(lastActual.date, matchupPeriodEnd);
    // Days from lastActual.date to projectionEnd
    const projectionDays = getDaysBetween(lastActual.date, projectionEnd);
    const totalRemaining = remainingDays.length - 1; // exclude the start day

    // Projected points use the same your_score / opponent_score keys so the
    // Area renders them as a continuous line. The `isProjected` flag lets the
    // dot renderer distinguish them visually (hollow rings vs solid dots).
    const projectedPoints: ChartPoint[] = projectionDays
      .slice(1) // skip the join date (already in basePoints as the last actual point)
      .map((date, i) => {
        const dayOffset = i + 1;
        const fraction = totalRemaining > 0 ? Math.min(1, dayOffset / totalRemaining) : 1;
        const yourProj = lastActualYour + (yourProjectionTarget - lastActualYour) * fraction;
        const oppProj = lastActualOpp + (oppProjectionTarget - lastActualOpp) * fraction;
        const dayLabel = `Day ${lastActualDay + dayOffset + 1}`;
        return {
          date,
          day: dayLabel,
          your_score: Math.round(yourProj * 10) / 10,
          opponent_score: Math.round(oppProj * 10) / 10,
          isLive: false,
          isProjected: true,
        };
      });

    return {
      chartData: [...basePoints, ...projectedPoints],
      mode: "future" as const,
    };
  }, [data.history, liveScore, selectedDate, todayDate, matchupPeriodEnd, yourProjectedScore, oppProjectedScore]);

  const lastPoint = chartData[chartData.length - 1];
  const latestYourScore = lastPoint?.your_score ?? 0;
  const latestOppScore = lastPoint?.opponent_score ?? 0;
  const isWinning = latestYourScore > latestOppScore;
  const scoreDiff = Math.abs(latestYourScore - latestOppScore).toFixed(1);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium tracking-tight">
            Score Progression
          </CardTitle>
          <div className="flex items-center gap-2">
            {mode === "past" && selectedDate && (
              <span className="text-[11px] text-muted-foreground">
                as of {formatShortDate(selectedDate)}
              </span>
            )}
            {mode === "future" && selectedDate && (
              <span className="text-[11px] text-muted-foreground">
                projected through {formatShortDate(selectedDate)}
              </span>
            )}
            <span
              className={`text-sm ${
                isWinning
                  ? "text-[hsl(var(--status-win))]"
                  : "text-[hsl(var(--status-loss))]"
              }`}
            >
              {isWinning ? "+" : "-"}
              {scoreDiff}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <ComposedChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 0, right: 12, top: 12, bottom: 0 }}
          >
            <defs>
              <linearGradient id="yourScoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="opponentScoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-4))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--chart-4))" stopOpacity={0.05} />
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
              content={(props) => {
                const { active, payload } = props ?? {};
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload as ChartPoint | undefined;
                return (
                  <ChartTooltipContent
                    {...props}
                    labelFormatter={(_, pl) => {
                      const date = (pl?.[0]?.payload as ChartPoint | undefined)?.date;
                      const prefix = point?.isProjected ? "(Projected) " : "";
                      if (date) {
                        const [y, m, d] = date.split("-").map(Number);
                        return prefix + new Date(y, m - 1, d).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        });
                      }
                      return "";
                    }}
                  />
                );
              }}
            />
            <ChartLegend content={<ChartLegendContent />} />

            <Area
              dataKey="your_score"
              type="monotone"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2.5}
              fill="url(#yourScoreGradient)"
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload?.isLive) {
                  return (
                    <circle
                      key={`live-your-${cx}`}
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill="hsl(var(--chart-1))"
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    />
                  );
                }
                if (payload?.isProjected) {
                  return (
                    <circle
                      key={`proj-your-${cx}`}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="hsl(var(--background))"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      strokeDasharray="3 2"
                    />
                  );
                }
                return (
                  <circle
                    key={`dot-your-${cx}`}
                    cx={cx}
                    cy={cy}
                    r={3}
                    fill="hsl(var(--chart-1))"
                    strokeWidth={0}
                  />
                );
              }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
            />
            <Area
              dataKey="opponent_score"
              type="monotone"
              stroke="hsl(var(--chart-4))"
              strokeWidth={2.5}
              fill="url(#opponentScoreGradient)"
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload?.isLive) {
                  return (
                    <circle
                      key={`live-opp-${cx}`}
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill="hsl(var(--chart-4))"
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    />
                  );
                }
                if (payload?.isProjected) {
                  return (
                    <circle
                      key={`proj-opp-${cx}`}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="hsl(var(--background))"
                      stroke="hsl(var(--chart-4))"
                      strokeWidth={2}
                      strokeDasharray="3 2"
                    />
                  );
                }
                return (
                  <circle
                    key={`dot-opp-${cx}`}
                    cx={cx}
                    cy={cy}
                    r={3}
                    fill="hsl(var(--chart-4))"
                    strokeWidth={0}
                  />
                );
              }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function MatchupScoreChart({
  teamId,
  matchupPeriod,
  liveScore,
  selectedDate,
  todayDate,
  matchupPeriodEnd,
  yourProjectedScore,
  oppProjectedScore,
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

  return (
    <ChartContent
      data={data}
      liveScore={liveScore}
      selectedDate={selectedDate}
      todayDate={todayDate}
      matchupPeriodEnd={matchupPeriodEnd}
      yourProjectedScore={yourProjectedScore}
      oppProjectedScore={oppProjectedScore}
    />
  );
}
