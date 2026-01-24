"use client";

import { MatchupDisplay } from "@/components/matchup-components/MatchupDisplay";
import { useMatchupQuery } from "@/hooks/useMatchup";
import { useTeams } from "@/app/context/TeamsContext";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Matchup() {
  const { selectedTeam, teams } = useTeams();
  const { data: matchup, isLoading, error } = useMatchupQuery(selectedTeam);

  const hasTeams = teams && teams.length > 0;

  return (
    <>
      <div className="flex items-center mb-4">
        <h1 className="text-lg font-semibold md:text-2xl">Matchup</h1>
      </div>
      <div className="flex flex-1 flex-col rounded-lg border border-primary border-dashed shadow-sm p-4">
        {!hasTeams ? (
          <Card className="p-6">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                You need to add a team to view matchup data.
              </p>
              <Link href="/your-teams">
                <Button>Add a Team</Button>
              </Link>
            </div>
          </Card>
        ) : !selectedTeam ? (
          <Card className="p-6">
            <p className="text-muted-foreground text-center">
              Select a team from the dropdown to view your current matchup.
            </p>
          </Card>
        ) : (
          <MatchupDisplay
            matchup={matchup}
            isLoading={isLoading}
            error={error}
            teamId={selectedTeam}
          />
        )}
      </div>
    </>
  );
}
