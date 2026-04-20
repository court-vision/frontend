"use client";

import { Medal, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayoffBracketQuery } from "@/hooks/usePlayoff";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import type { PlayoffSeriesData } from "@/types/playoff";

function SeriesCard({ series }: { series: PlayoffSeriesData }) {
  const topWins = series.top_seed_wins;
  const bottomWins = series.bottom_seed_wins;
  const topLeads = topWins > bottomWins;
  const bottomLeads = bottomWins > topWins;
  const active = topWins > 0 || bottomWins > 0;

  return (
    <Card
      variant="panel"
      className="p-3 space-y-2"
    >
      {/* Team rows */}
      {[
        { abbr: series.top_seed_abbr, name: series.top_seed_name, wins: topWins, leads: topLeads },
        { abbr: series.bottom_seed_abbr, name: series.bottom_seed_name, wins: bottomWins, leads: bottomLeads },
      ].map((team) => (
        <div
          key={team.abbr}
          className={cn(
            "flex items-center gap-2",
            series.series_complete && !team.leads && "opacity-40"
          )}
        >
          <span className={cn(
            "font-mono text-sm font-bold w-10",
            team.leads ? "text-foreground" : "text-muted-foreground"
          )}>
            {team.abbr}
          </span>
          <span className={cn(
            "text-xs flex-1 truncate",
            team.leads ? "text-foreground" : "text-muted-foreground"
          )}>
            {team.name || ""}
          </span>
          {/* Win pips */}
          <div className="flex gap-0.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 w-2 rounded-full",
                  i < team.wins ? "bg-primary" : "bg-muted-foreground/20"
                )}
              />
            ))}
          </div>
          <span className="font-mono text-sm font-bold w-4 text-right">
            {team.wins}
          </span>
        </div>
      ))}

      {/* Status */}
      <div className="flex items-center gap-1.5 pt-0.5 border-t border-border/50">
        {series.series_complete ? (
          <>
            <CheckCircle2 className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[11px] text-muted-foreground/50">
              {series.series_leader_abbr} wins series
            </span>
          </>
        ) : active ? (
          <>
            <Circle className="h-3 w-3 text-signal-live animate-pulse" />
            <span className="text-[11px] text-muted-foreground/60">
              {series.series_leader_abbr
                ? `${series.series_leader_abbr} leads`
                : "Series tied"}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground/40">Not started</span>
        )}
        <Link
          href="/terminal"
          className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground/40 hover:text-primary transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Live
        </Link>
      </div>
    </Card>
  );
}

export default function PlayoffsPage() {
  const { data: bracket, isLoading } = usePlayoffBracketQuery();

  return (
    <div className="space-y-6 animate-slide-up-fade">
      <section>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Playoffs
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {bracket ? `${bracket.season} NBA Playoff bracket` : "NBA playoff bracket — updated nightly."}
        </p>
      </section>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {bracket && bracket.rounds.map((round) => (
        <section key={round.round_num} className="space-y-3">
          <div className="flex items-center gap-2">
            <Medal className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold text-sm tracking-wide">{round.round_name}</h2>
            <span className="text-xs text-muted-foreground/50">
              ({round.series.filter((s) => s.series_complete).length}/{round.series.length} complete)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {round.series.map((series) => (
              <SeriesCard key={series.series_id} series={series} />
            ))}
          </div>
        </section>
      ))}

      {!isLoading && !bracket && (
        <Card variant="panel" className="p-8">
          <div className="text-center space-y-2">
            <Medal className="h-8 w-8 text-muted-foreground/20 mx-auto" />
            <p className="text-sm text-muted-foreground">No bracket data yet.</p>
            <p className="text-xs text-muted-foreground/60">
              The playoff bracket pipeline runs nightly at 1 AM ET once the playoffs begin.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
