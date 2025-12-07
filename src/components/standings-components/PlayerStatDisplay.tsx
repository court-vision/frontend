"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { usePlayerStatsQuery } from "@/hooks/usePlayer";
import type { PlayerStats } from "@/types/player";

interface PlayerStatDisplayProps {
  playerId: number;
}

export default function PlayerStatDisplay({
  playerId,
}: PlayerStatDisplayProps) {
  const { data: playerStats, isLoading } = usePlayerStatsQuery(playerId);

  if (isLoading) {
    return <div>Loading player stats...</div>;
  }

  if (!playerStats) {
    return <div>No stats available for this player.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-secondary p-4 rounded shadow">
          <h4 className="text-center text-xs">PTS/G</h4>
          <p className="text-center font-bold">
            {playerStats.avg_stats.avg_points}
          </p>
        </div>
        <div className="bg-secondary p-4 rounded shadow">
          <h4 className="text-center text-xs">REB/G</h4>
          <p className="text-center font-bold">
            {playerStats.avg_stats.avg_rebounds}
          </p>
        </div>
        <div className="bg-secondary p-4 rounded shadow">
          <h4 className="text-center text-xs">AST/G</h4>
          <p className="text-center font-bold">
            {playerStats.avg_stats.avg_assists}
          </p>
        </div>
        <div className="bg-secondary p-4 rounded shadow">
          <h4 className="text-center text-xs">FPTS/G</h4>
          <p className="text-center font-bold">
            {playerStats.avg_stats.avg_fpts}
          </p>
        </div>
      </div>
      <PlayerStatChart playerStats={playerStats} />
    </div>
  );
}

const chartConfig = {
  fpts: {
    label: "Fantasy Points",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

function PlayerStatChart({ playerStats }: { playerStats: PlayerStats }) {
  return (
    <Card className="border-none">
      <CardHeader>
        <CardTitle>{playerStats.name}&apos;s Fantasy Scores</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={playerStats.game_logs}
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
              content={<ChartTooltipContent hideLabel />}
            />
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
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
