"use client";

import { useMemo } from "react";
import { MatchupDisplay } from "@/components/matchup-components/MatchupDisplay";
import { useMatchupQuery } from "@/hooks/useMatchup";
import { useTeams } from "@/app/context/TeamsContext";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { FantasyProvider } from "@/types/team";

export default function Matchup() {
  const { selectedTeam, teams } = useTeams();
  const { data: matchup, isLoading, error } = useMatchupQuery(selectedTeam);

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
        <h1 className="font-display text-xl font-bold tracking-tight">
          Matchup
        </h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          Head-to-head matchup for the current week.
        </p>
      </section>

      {!hasTeams ? (
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
          isLoading={isLoading}
          error={error}
          teamId={selectedTeam}
          provider={provider}
        />
      )}
    </div>
  );
}
