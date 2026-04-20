"use client";

import { Medal, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayoffBracketQuery } from "@/hooks/usePlayoff";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlayoffSeriesData, PlayoffRound } from "@/types/playoff";

function SeriesRow({ series, onTeamClick }: { series: PlayoffSeriesData; onTeamClick: (abbr: string) => void }) {
  const topWins = series.top_seed_wins;
  const bottomWins = series.bottom_seed_wins;
  const total = topWins + bottomWins;
  const topLeads = topWins > bottomWins;
  const bottomLeads = bottomWins > topWins;

  return (
    <div className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/30 transition-colors">
      {/* Top seed */}
      <button
        onClick={() => onTeamClick(series.top_seed_abbr)}
        className={cn(
          "font-mono text-xs font-bold w-8 text-left hover:text-primary transition-colors",
          topLeads ? "text-foreground" : "text-muted-foreground",
          series.series_complete && !topLeads && "opacity-40"
        )}
      >
        {series.top_seed_abbr}
      </button>

      {/* Win pips */}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 w-2 rounded-full",
              i < topWins
                ? topLeads || series.series_complete
                  ? "bg-foreground"
                  : "bg-muted-foreground/50"
                : "bg-muted-foreground/20"
            )}
          />
        ))}
      </div>

      {/* Score */}
      <span className="font-mono text-[11px] text-muted-foreground w-7 text-center">
        {topWins}–{bottomWins}
      </span>

      {/* Win pips (bottom) */}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 w-2 rounded-full",
              i < bottomWins
                ? bottomLeads || series.series_complete
                  ? "bg-foreground"
                  : "bg-muted-foreground/50"
                : "bg-muted-foreground/20"
            )}
          />
        ))}
      </div>

      {/* Bottom seed */}
      <button
        onClick={() => onTeamClick(series.bottom_seed_abbr)}
        className={cn(
          "font-mono text-xs font-bold w-8 text-right hover:text-primary transition-colors",
          bottomLeads ? "text-foreground" : "text-muted-foreground",
          series.series_complete && !bottomLeads && "opacity-40"
        )}
      >
        {series.bottom_seed_abbr}
      </button>

      {/* Status */}
      <div className="ml-auto">
        {series.series_complete ? (
          <CheckCircle2 className="h-3 w-3 text-muted-foreground/40" />
        ) : total > 0 ? (
          <Circle className="h-3 w-3 text-signal-live animate-pulse" />
        ) : (
          <Circle className="h-3 w-3 text-muted-foreground/20" />
        )}
      </div>
    </div>
  );
}

function ConferenceColumn({ label, rounds, onTeamClick }: { label: "East" | "West" | "All"; rounds: PlayoffRound[]; onTeamClick: (abbr: string) => void }) {
  // Filter series by conference (or show all for Finals)
  const confs = label === "All" ? ["East", "West", "Finals"] : [label, "Finals"];

  return (
    <div className="flex-1 min-w-0 space-y-3">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest px-2">{label === "All" ? "Bracket" : label}</p>
      {rounds.map((round) => {
        const series = round.series.filter((s) => confs.includes(s.conference));
        if (series.length === 0) return null;
        return (
          <div key={round.round_num} className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground/50 px-2 uppercase tracking-wide">{round.round_name}</p>
            {series.map((s) => (
              <SeriesRow key={s.series_id} series={s} onTeamClick={onTeamClick} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function PlayoffBracketPanel() {
  const { setFocusedNBATeam } = useTerminalStore();
  const { data: bracket, isLoading, error } = usePlayoffBracketQuery();

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (error || !bracket) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <Medal className="h-8 w-8 opacity-20" />
        <p className="text-xs">No playoff data available</p>
        <p className="text-[11px] opacity-60">Pipeline runs nightly at 1 AM ET</p>
      </div>
    );
  }

  const handleTeamClick = (abbr: string) => {
    setFocusedNBATeam(abbr);
  };

  // Split rounds into East/West (rounds 1-3) and Finals (round 4)
  const mainRounds = bracket.rounds.filter((r) => r.round_num <= 3);
  const finalsRound = bracket.rounds.filter((r) => r.round_num === 4);

  const eastRounds = mainRounds.map((r) => ({
    ...r,
    series: r.series.filter((s) => s.conference === "East"),
  })).filter((r) => r.series.length > 0);

  const westRounds = mainRounds.map((r) => ({
    ...r,
    series: r.series.filter((s) => s.conference === "West"),
  })).filter((r) => r.series.length > 0);

  return (
    <div className="flex flex-col h-full overflow-hidden p-3 gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <Medal className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">{bracket.season} NBA Playoffs</span>
      </div>

      {/* Bracket grid */}
      <div className="flex gap-4 overflow-y-auto flex-1 min-h-0">
        <ConferenceColumn label="East" rounds={eastRounds} onTeamClick={handleTeamClick} />
        <div className="w-px bg-border shrink-0" />

        {/* Finals in the middle */}
        {finalsRound.length > 0 && (
          <>
            <ConferenceColumn label="All" rounds={finalsRound} onTeamClick={handleTeamClick} />
            <div className="w-px bg-border shrink-0" />
          </>
        )}

        <ConferenceColumn label="West" rounds={westRounds} onTeamClick={handleTeamClick} />
      </div>

      <p className="text-[10px] text-muted-foreground/40 shrink-0">Click a team abbreviation to open its live game in the terminal.</p>
    </div>
  );
}
