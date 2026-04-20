"use client";

import { TrendingUp, TrendingDown, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SeasonSummaryData } from "@/types/matchup";

interface Props {
  summary: SeasonSummaryData;
}

export function SeasonSummaryCard({ summary }: Props) {
  const { wins, losses, total_points_for, total_points_against, best_week, worst_week, weeks } = summary;
  const winPct = weeks.length > 0 ? ((wins / weeks.length) * 100).toFixed(0) : "0";
  const ppgFor = weeks.length > 0 ? (total_points_for / weeks.length).toFixed(1) : "0";
  const ppgAgainst = weeks.length > 0 ? (total_points_against / weeks.length).toFixed(1) : "0";

  return (
    <Card variant="panel" className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-primary" />
        <h2 className="font-display font-bold text-sm tracking-wide">2025–26 Season Record</h2>
      </div>

      {/* W/L + win % */}
      <div className="flex items-center gap-6">
        <div className="text-center">
          <p className="text-3xl font-display font-black text-foreground">
            {wins}
            <span className="text-muted-foreground/40 mx-1 font-normal">–</span>
            {losses}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{winPct}% win rate</p>
        </div>
        <div className="h-10 w-px bg-border" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
          <div>
            <p className="text-[11px] text-muted-foreground">Avg PF</p>
            <p className="font-mono font-medium">{ppgFor}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Avg PA</p>
            <p className="font-mono font-medium">{ppgAgainst}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Total PF</p>
            <p className="font-mono font-medium">{total_points_for.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Total PA</p>
            <p className="font-mono font-medium">{total_points_against.toFixed(1)}</p>
          </div>
        </div>
      </div>

      {/* Best / Worst week */}
      {(best_week || worst_week) && (
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border">
          {best_week && (
            <div className="flex items-start gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground">Best week</p>
                <p className="text-xs font-medium">Wk {best_week.matchup_period} · {best_week.points_for.toFixed(1)} pts</p>
                <p className="text-[11px] text-muted-foreground truncate">vs {best_week.opponent_team_name}</p>
              </div>
            </div>
          )}
          {worst_week && (
            <div className="flex items-start gap-2">
              <TrendingDown className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground">Worst week</p>
                <p className="text-xs font-medium">Wk {worst_week.matchup_period} · {worst_week.points_for.toFixed(1)} pts</p>
                <p className="text-[11px] text-muted-foreground truncate">vs {worst_week.opponent_team_name}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Per-week W/L bar */}
      <div className="pt-1 border-t border-border">
        <p className="text-[11px] text-muted-foreground mb-1.5">Week-by-week results</p>
        <div className="flex items-center gap-0.5 flex-wrap">
          {weeks.map((w) => (
            <div
              key={w.matchup_period}
              title={`Wk ${w.matchup_period}: ${w.points_for.toFixed(1)} vs ${w.opponent_team_name} · ${w.won ? "W" : "L"}`}
              className={cn(
                "h-5 w-5 rounded-sm text-[9px] font-bold flex items-center justify-center cursor-default",
                w.won
                  ? "bg-green-500/15 text-green-500 border border-green-500/20"
                  : "bg-red-500/15 text-red-500 border border-red-500/20"
              )}
            >
              {w.won ? "W" : "L"}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
