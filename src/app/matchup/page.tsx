"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MatchupDisplay } from "@/components/matchup-components/MatchupDisplay";
import { useMatchupQuery, useLiveMatchupQuery, useSeasonSummaryQuery } from "@/hooks/useMatchup";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import { Card } from "@/components/ui/card";
import { SeasonBanner } from "@/components/SeasonBanner";
import { SeasonSummaryCard } from "@/components/matchup-components/SeasonSummaryCard";
import { ConnectTeamPrompt } from "@/components/teams-components/ConnectTeamPrompt";
import { useSeason } from "@/hooks/useSeason";
import { seasonHeadline } from "@/lib/season";
import { MOCK_CATEGORY_LIVE_MATCHUP, MOCK_CATEGORY_MATCHUP } from "@/__fixtures__/categoryMatchup";

// Dev-only: `/matchup?mock=cats` renders a fixture 9-cat matchup so the
// category surfaces can be checked before a category league is connected.
const MOCKS_ENABLED = process.env.NODE_ENV !== "production";

function MatchupContent() {
  const searchParams = useSearchParams();
  const mock = MOCKS_ENABLED && searchParams.get("mock") === "cats";
  const { teamId: selectedTeam, teams, isLoading: isTeamsLoading, provider } = useSelectedTeam();
  const { data: matchup, isLoading, error } = useMatchupQuery(mock ? null : selectedTeam);
  const { data: liveMatchup } = useLiveMatchupQuery(mock ? null : selectedTeam);
  const { data: seasonSummary } = useSeasonSummaryQuery(mock ? null : selectedTeam);
  const season = useSeason();

  const hasTeams = teams.length > 0;

  return (
    <div className="space-y-4 animate-slide-up-fade">
      <section>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Matchup
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {mock ? "Mock 9-cat matchup (dev only)." : seasonHeadline("matchup", season.phase, season)}
        </p>
      </section>
      {!mock && <SeasonBanner />}

      {seasonSummary && <SeasonSummaryCard summary={seasonSummary} />}

      {mock ? (
        <MatchupDisplay
          matchup={MOCK_CATEGORY_MATCHUP}
          liveMatchup={MOCK_CATEGORY_LIVE_MATCHUP}
          isLoading={false}
          error={null}
          teamId={0}
          provider="espn"
        />
      ) : isTeamsLoading ? (
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

export default function Matchup() {
  return (
    <Suspense fallback={<div className="space-y-4 animate-slide-up-fade" />}>
      <MatchupContent />
    </Suspense>
  );
}
