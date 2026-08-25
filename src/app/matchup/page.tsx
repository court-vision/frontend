"use client";

import { MatchupDisplay } from "@/components/matchup-components/MatchupDisplay";
import { useMatchupQuery, useLiveMatchupQuery, useSeasonSummaryQuery } from "@/hooks/useMatchup";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import { Card } from "@/components/ui/card";
import { SeasonBanner } from "@/components/SeasonBanner";
import { SeasonSummaryCard } from "@/components/matchup-components/SeasonSummaryCard";
import { ConnectTeamPrompt } from "@/components/teams-components/ConnectTeamPrompt";
import { seasonHeadline } from "@/lib/season";

export default function Matchup() {
  const { teamId: selectedTeam, teams, isLoading: isTeamsLoading, provider } = useSelectedTeam();
  const { data: matchup, isLoading, error } = useMatchupQuery(selectedTeam);
  const { data: liveMatchup } = useLiveMatchupQuery(selectedTeam);
  const { data: seasonSummary } = useSeasonSummaryQuery(selectedTeam);

  const hasTeams = teams.length > 0;

  return (
    <div className="space-y-4 animate-slide-up-fade">
      <section>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Matchup
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {seasonHeadline("matchup")}
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
        <ConnectTeamPrompt description="Add a team to see your weekly matchup, live scoring, and day-by-day breakdowns." />
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
