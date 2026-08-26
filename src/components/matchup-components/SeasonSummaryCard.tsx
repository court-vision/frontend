"use client";

import { TrendingUp, TrendingDown, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { HintPopover } from "@/components/ui/hint";
import { cn } from "@/lib/utils";
import { useSeason } from "@/hooks/useSeason";
import { seasonHeadline } from "@/lib/season";
import type { SeasonSummaryData, WeekResult } from "@/types/matchup";

interface Props {
  summary: SeasonSummaryData;
}

function weekLabel(w: WeekResult, isCategories: boolean): string {
  if (isCategories && w.categories_won != null && w.categories_lost != null) {
    return `${w.categories_won}-${w.categories_lost}-${w.categories_tied ?? 0}`;
  }
  return `${w.points_for.toFixed(1)} pts`;
}

function weekOutcome(w: WeekResult, isCategories: boolean): "W" | "L" | "T" {
  if (isCategories && w.categories_won != null && w.categories_lost != null && w.categories_won === w.categories_lost) {
    return "T";
  }
  return w.won ? "W" : "L";
}

export function SeasonSummaryCard({ summary }: Props) {
  const season = useSeason();
  const { wins, losses, total_points_for, total_points_against, best_week, worst_week, weeks } = summary;
  const isCategories = summary.scoring_format === "categories";
  const winPct = weeks.length > 0 ? ((wins / weeks.length) * 100).toFixed(0) : "0";
  const ppgFor = weeks.length > 0 ? (total_points_for / weeks.length).toFixed(1) : "0";
  const ppgAgainst = weeks.length > 0 ? (total_points_against / weeks.length).toFixed(1) : "0";
  const catsWon = weeks.reduce((s, w) => s + (w.categories_won ?? 0), 0);
  const catsLost = weeks.reduce((s, w) => s + (w.categories_lost ?? 0), 0);
  const catsTied = weeks.reduce((s, w) => s + (w.categories_tied ?? 0), 0);
  const catsPerWeek = weeks.length > 0 ? (catsWon / weeks.length).toFixed(1) : "0";

  return (
    <Card variant="panel" className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-primary" />
        <h2 className="font-display font-bold text-sm tracking-wide">{seasonHeadline("summary", season.phase, season)}</h2>
      </div>

      {/* W/L + win % — stacks on phones */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="text-left sm:text-center">
          <p className="text-3xl font-display font-black text-foreground">
            {wins}
            <span className="text-muted-foreground/40 mx-1 font-normal">–</span>
            {losses}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{winPct}% win rate</p>
        </div>
        <div className="hidden sm:block h-10 w-px bg-border" />
        {isCategories ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
            <div>
              <p className="text-[11px] text-muted-foreground">Cats won</p>
              <p className="font-mono font-medium text-status-win">{catsWon}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Cats lost</p>
              <p className="font-mono font-medium text-status-loss">{catsLost}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Cats tied</p>
              <p className="font-mono font-medium">{catsTied}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Won / week</p>
              <p className="font-mono font-medium">{catsPerWeek}</p>
            </div>
          </div>
        ) : (
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
        )}
      </div>

      {/* Best / Worst week */}
      {(best_week || worst_week) && (
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border">
          {best_week && (
            <div className="flex items-start gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground">Best week</p>
                <p className="text-xs font-medium">Wk {best_week.matchup_period} · {weekLabel(best_week, isCategories)}</p>
                <p className="text-[11px] text-muted-foreground truncate">vs {best_week.opponent_team_name}</p>
              </div>
            </div>
          )}
          {worst_week && (
            <div className="flex items-start gap-2">
              <TrendingDown className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground">Worst week</p>
                <p className="text-xs font-medium">Wk {worst_week.matchup_period} · {weekLabel(worst_week, isCategories)}</p>
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
          {weeks.map((w) => {
            const outcome = weekOutcome(w, isCategories);
            return (
              // Hover tooltip with a mouse, tap-to-open popover on touch (a `title` never shows there)
              <HintPopover
                key={w.matchup_period}
                content={`Wk ${w.matchup_period}: ${weekLabel(w, isCategories)} vs ${w.opponent_team_name} · ${outcome}`}
              >
                <div
                  className={cn(
                    "h-7 w-7 text-[10px] sm:h-5 sm:w-5 sm:text-[9px] rounded-sm font-bold flex items-center justify-center cursor-default border",
                    outcome === "W"
                      ? "bg-status-win/15 text-status-win border-status-win/20"
                      : outcome === "L"
                        ? "bg-status-loss/15 text-status-loss border-status-loss/20"
                        : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  {outcome}
                </div>
              </HintPopover>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
