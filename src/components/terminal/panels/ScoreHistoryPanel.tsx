"use client";

import { AlertCircle, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useMatchupScoreHistoryQuery } from "@/hooks/useMatchup";
import { Skeleton } from "@/components/ui/skeleton";
import type { DailyScorePoint } from "@/types/matchup";

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

function TerminalTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border/60 px-2 py-1 text-[10px] font-mono shadow-md">
      <div className="text-muted-foreground mb-0.5">Day {label}</div>
      {payload.map((entry) => (
        <div key={entry.name} style={{ color: entry.color }}>
          {entry.name === "your_score" ? "YOU" : "OPP"}: {entry.value.toFixed(1)}
        </div>
      ))}
    </div>
  );
}

export function ScoreHistoryPanel() {
  const { focusedTeamId } = useTerminalStore();
  const { data, isLoading, error } = useMatchupScoreHistoryQuery(focusedTeamId);

  if (!focusedTeamId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <TrendingUp className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No team selected</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-2 gap-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="flex-1 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertCircle className="h-6 w-6 text-destructive/50 mb-2" />
        <p className="text-xs text-destructive">Failed to load score history</p>
      </div>
    );
  }

  const history = data;
  const { team_name, opponent_team_name, matchup_period } = history;
  const points: DailyScorePoint[] = history.history ?? [];

  const latest = points.length > 0 ? points[points.length - 1] : null;

  const chartData = points.map((p) => ({
    day: p.day_of_matchup,
    your_score: p.your_score,
    opponent_score: p.opponent_score,
  }));

  const yourLead =
    latest != null
      ? latest.your_score - latest.opponent_score
      : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/40 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-mono font-semibold text-primary truncate uppercase tracking-wide">
              {team_name}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">vs</span>
            <span className="text-[10px] font-mono text-muted-foreground truncate uppercase tracking-wide">
              {opponent_team_name}
            </span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">
            WK{matchup_period}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 px-1 py-2">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[10px] text-muted-foreground">No data yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
            >
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontFamily: "monospace" }}
                tickFormatter={(v) => `D${v + 1}`}
                interval={0}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontFamily: "monospace" }}
                width={32}
                domain={["auto", "auto"]}
                tickFormatter={(v) => v.toFixed(0)}
              />
              <Tooltip
                content={<TerminalTooltip />}
                cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="your_score"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                dot={{ r: 2, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="opponent_score"
                stroke="hsl(var(--destructive))"
                strokeWidth={1.5}
                strokeOpacity={0.7}
                dot={{ r: 2, fill: "hsl(var(--destructive))", strokeWidth: 0 }}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer: current totals */}
      {latest && (
        <div className="px-3 py-1.5 border-t border-border/40 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span
                className="inline-block w-2 h-0.5 rounded"
                style={{ backgroundColor: "hsl(var(--primary))" }}
              />
              <span className="font-mono text-[10px] tabular-nums text-primary font-semibold">
                {latest.your_score.toFixed(1)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span
                className="inline-block w-2 h-0.5 rounded opacity-70"
                style={{ backgroundColor: "hsl(var(--destructive))" }}
              />
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {latest.opponent_score.toFixed(1)}
              </span>
            </div>
          </div>
          {yourLead !== null && (
            <span
              className={cn(
                "font-mono text-[10px] tabular-nums font-semibold",
                yourLead >= 0 ? "text-emerald-500" : "text-destructive"
              )}
            >
              {yourLead >= 0 ? "+" : ""}
              {yourLead.toFixed(1)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
