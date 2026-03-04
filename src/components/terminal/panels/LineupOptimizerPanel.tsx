"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Zap, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useGenerateLineupMutation, useScheduleWeeksQuery } from "@/hooks/useLineups";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SlimGene, SlimPlayer } from "@/types/lineup";

// Position display order for the roster
const POSITION_ORDER = ["PG", "SG", "SF", "PF", "C", "G", "F", "UTIL", "BE", "BE1", "BE2", "BE3"];

function sortPositions(entries: [string, SlimPlayer][]): [string, SlimPlayer][] {
  return [...entries].sort(([a], [b]) => {
    const ai = POSITION_ORDER.indexOf(a);
    const bi = POSITION_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function DayCard({ gene, dayLabel }: { gene: SlimGene; dayLabel: string }) {
  const [expanded, setExpanded] = useState(true);
  const rosterEntries = sortPositions(Object.entries(gene.Roster));

  return (
    <div className="border-b border-border/30 last:border-0">
      {/* Day header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 w-full px-3 py-1 hover:bg-muted/30 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wide text-primary/80">
          {dayLabel}
        </span>
        {gene.Additions.length > 0 && (
          <span className="ml-auto text-[9px] font-mono text-emerald-500">
            +{gene.Additions.length}
          </span>
        )}
        {gene.Removals.length > 0 && (
          <span className="text-[9px] font-mono text-destructive/70 ml-1">
            -{gene.Removals.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="pb-1">
          {/* Move summary */}
          {(gene.Additions.length > 0 || gene.Removals.length > 0) && (
            <div className="px-3 py-0.5 flex flex-col gap-0.5 border-b border-border/20 mb-0.5">
              {gene.Additions.map((p) => (
                <div key={p.Name} className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono text-emerald-500 w-3">+</span>
                  <span className="text-[10px] flex-1 truncate">{p.Name}</span>
                  <span className="text-[9px] font-mono text-muted-foreground shrink-0">{p.Team}</span>
                  <span className="text-[9px] font-mono tabular-nums text-muted-foreground/70 shrink-0 w-8 text-right">
                    {p.AvgPoints.toFixed(1)}
                  </span>
                </div>
              ))}
              {gene.Removals.map((p) => (
                <div key={p.Name} className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono text-destructive/70 w-3">-</span>
                  <span className="text-[10px] flex-1 truncate text-muted-foreground/60">{p.Name}</span>
                  <span className="text-[9px] font-mono text-muted-foreground/40 shrink-0">{p.Team}</span>
                  <span className="text-[9px] font-mono tabular-nums text-muted-foreground/40 shrink-0 w-8 text-right">
                    {p.AvgPoints.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Roster */}
          {rosterEntries.map(([slot, player]) => (
            <div
              key={slot}
              className="flex items-center gap-2 px-3 py-0.5 hover:bg-muted/20 transition-colors"
            >
              <span className="text-[9px] font-mono text-muted-foreground/60 w-8 shrink-0 uppercase">
                {slot}
              </span>
              <span className="text-[10px] flex-1 truncate">{player.Name}</span>
              <span className="text-[9px] font-mono text-muted-foreground/50 shrink-0">{player.Team}</span>
              <span className="text-[9px] font-mono tabular-nums text-muted-foreground shrink-0 w-8 text-right">
                {player.AvgPoints.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STREAMING_OPTIONS = [0, 1, 2] as const;
type StreamingSlots = (typeof STREAMING_OPTIONS)[number];

export function LineupOptimizerPanel() {
  const { focusedTeamId, setGeneratedLineup } = useTerminalStore();
  const { data: scheduleData, isLoading: scheduleLoading } = useScheduleWeeksQuery();
  const generateMutation = useGenerateLineupMutation();

  const weeks = scheduleData?.weeks ?? [];
  const defaultWeek = scheduleData?.current_week ?? weeks[0]?.week ?? null;

  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [streamingSlots, setStreamingSlots] = useState<StreamingSlots>(1);
  const [weekMenuOpen, setWeekMenuOpen] = useState(false);

  // Set default week once schedule loads
  useEffect(() => {
    if (selectedWeek === null && defaultWeek !== null) {
      setSelectedWeek(defaultWeek);
    }
  }, [defaultWeek, selectedWeek]);

  const lineup = generateMutation.data?.data ?? null;
  const isPending = generateMutation.isPending;
  const hasError = generateMutation.isError || generateMutation.data?.status === "error";

  // Sync generated lineup to store for the combined matchup panel
  useEffect(() => {
    setGeneratedLineup(lineup);
  }, [lineup, setGeneratedLineup]);

  const handleGenerate = () => {
    if (!focusedTeamId || selectedWeek === null) return;
    generateMutation.mutate({
      team_id: focusedTeamId,
      streaming_slots: streamingSlots,
      week: selectedWeek,
    });
  };

  if (!focusedTeamId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Zap className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No team selected</p>
      </div>
    );
  }

  const selectedWeekData = weeks.find((w) => w.week === selectedWeek);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Config bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 shrink-0 flex-wrap">
        {/* Week selector */}
        <div className="relative">
          <button
            onClick={() => setWeekMenuOpen((v) => !v)}
            disabled={scheduleLoading || isPending}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono border border-border/50",
              "hover:bg-muted/50 transition-colors disabled:opacity-50",
              "bg-muted/30"
            )}
          >
            {scheduleLoading ? (
              <span className="text-muted-foreground">Loading...</span>
            ) : selectedWeekData ? (
              <>
                <span className="text-primary/80">WK{selectedWeekData.week}</span>
                <span className="text-muted-foreground/60 text-[9px] ml-1">
                  {formatDate(selectedWeekData.start_date)}–{formatDate(selectedWeekData.end_date)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Select week</span>
            )}
            <ChevronDown className="h-3 w-3 text-muted-foreground ml-1" />
          </button>

          {weekMenuOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border shadow-md rounded min-w-[160px] max-h-48 overflow-y-auto">
              {weeks.map((week) => (
                <button
                  key={week.week}
                  onClick={() => {
                    setSelectedWeek(week.week);
                    setWeekMenuOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-[10px] font-mono hover:bg-muted/50 transition-colors",
                    week.week === selectedWeek && "text-primary bg-primary/10"
                  )}
                >
                  <span className="font-semibold">WK{week.week}</span>
                  <span className="text-muted-foreground ml-2 text-[9px]">
                    {formatDate(week.start_date)}–{formatDate(week.end_date)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Streaming slots toggle */}
        <div className="flex items-center gap-px bg-muted/30 border border-border/50 rounded overflow-hidden">
          {STREAMING_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setStreamingSlots(n)}
              disabled={isPending}
              className={cn(
                "px-2 py-1 text-[10px] font-mono transition-colors disabled:opacity-50",
                streamingSlots === n
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-muted/60"
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="text-[9px] text-muted-foreground/50 font-mono">slots</span>

        {/* Generate button */}
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={isPending || selectedWeek === null || scheduleLoading}
          className={cn(
            "h-6 px-3 text-[10px] font-mono ml-auto",
            "gap-1"
          )}
        >
          <Zap className="h-3 w-3" />
          {isPending ? "Generating..." : "Generate"}
        </Button>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isPending && (
          <div className="flex flex-col gap-1.5 p-2">
            <Skeleton className="h-6 w-1/3" />
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {!isPending && hasError && (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <AlertCircle className="h-6 w-6 text-destructive/50 mb-2" />
            <p className="text-xs text-destructive">
              {generateMutation.data?.message ?? "Failed to generate lineup"}
            </p>
          </div>
        )}

        {!isPending && !hasError && !lineup && (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <Zap className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-[10px] text-muted-foreground/60 font-mono">
              Configure and generate a lineup
            </p>
          </div>
        )}

        {!isPending && lineup && (
          <div className="flex flex-col">
            {/* Summary header */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-muted/10 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wide">
                  Week {lineup.Week}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground/40">·</span>
                <span className="text-[9px] font-mono text-muted-foreground">
                  {lineup.StreamingSlots} streaming slot{lineup.StreamingSlots !== 1 ? "s" : ""}
                </span>
              </div>
              {lineup.Improvement > 0 && (
                <span className="text-[10px] font-mono font-semibold text-emerald-500 tabular-nums">
                  +{lineup.Improvement.toFixed(1)} proj
                </span>
              )}
            </div>

            {/* Day cards */}
            {lineup.Lineup.map((gene: SlimGene, idx: number) => {
              // Derive a label: Day 1, Day 2, etc. (Day is 0-indexed in the type)
              const dayLabel = `Day ${idx + 1}`;
              return (
                <DayCard
                  key={`${gene.Day}-${idx}`}
                  gene={gene}
                  dayLabel={dayLabel}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
