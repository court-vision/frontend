"use client";

import { useMemo } from "react";
import { MatchupDisplay } from "@/components/matchup-components/MatchupDisplay";
import { useMatchupQuery, useLiveMatchupQuery } from "@/hooks/useMatchup";
import { useTeams } from "@/app/context/TeamsContext";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SeasonBanner } from "@/components/SeasonBanner";
import { SeasonSummaryCard } from "@/components/matchup-components/SeasonSummaryCard";
import { useSeasonSummaryQuery } from "@/hooks/useMatchup";
import type { FantasyProvider } from "@/types/team";

export default function Matchup() {
  const { selectedTeam, teams, isTeamsLoading } = useTeams();
  const { data: matchup, isLoading, error } = useMatchupQuery(selectedTeam);
  const { data: liveMatchup } = useLiveMatchupQuery(selectedTeam);
  const { data: seasonSummary } = useSeasonSummaryQuery(selectedTeam);

  const hasTeams = teams && teams.length > 0;

  // Find the selected team's provider
  const provider = useMemo<FantasyProvider>(() => {
    if (!selectedTeam || !teams) return "espn";
    const team = teams.find((t) => t.team_id === selectedTeam);
    return team?.league_info?.provider || "espn";
  }, [selectedTeam, teams]);

  return (
    <div className="space-y-4 animate-slide-up-fade">
      <section>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Matchup
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Final matchup results — 2025–26 regular season.
        </p>
      </section>
      <SeasonBanner />

      {seasonSummary && <SeasonSummaryCard summary={seasonSummary} />}

      {isTeamsLoading ? (
        <MatchupDisplay
          matchup={undefined}
          liveMatchup={undefined}
          isLoading={true}
          error={null}
          teamId={0}
          provider={provider}
        />
      ) : !hasTeams ? (
        <Card variant="panel" className="p-8">
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              You need to add a team to view matchup data.
            </p>
            <Link href="/manage-teams">
              <Button size="sm">Add a Team</Button>
            </Link>
          </div>
        </Card>
      ) : !selectedTeam ? (
        <Card variant="panel" className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            Select a team from the nav bar to view your current matchup.
          </p>
        </Card>
      ) : (
        <MatchupDisplay
          matchup={matchup}
          liveMatchup={liveMatchup}
          isLoading={isLoading}
          error={error}
          teamId={selectedTeam}
          provider={provider}
        />
      )}
    </div>
  );
}
