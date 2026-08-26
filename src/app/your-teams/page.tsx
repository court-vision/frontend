"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useUIStore } from "@/stores/useUIStore";
import { useTeamInsightsQuery } from "@/hooks/useTeams";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import { TeamDashboard } from "@/components/teams-components/TeamDashboard";
import { ConnectTeamPrompt } from "@/components/teams-components/ConnectTeamPrompt";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-error";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Settings } from "lucide-react";
import { scoringLabel } from "@/lib/category-format";

export default function Teams() {
  const { isSignedIn, isLoaded } = useUser();
  const setSelectedTeam = useUIStore((s) => s.setSelectedTeam);
  const {
    teamId: selectedTeam,
    team: selectedTeamData,
    teams,
    league,
    provider,
    isLoading: isTeamsLoading,
    teamsError,
    refetchTeams,
  } = useSelectedTeam();
  const {
    data: insights,
    isLoading: isInsightsLoading,
    error: insightsError,
    refetch: refetchInsights,
    isFetching: isInsightsFetching,
  } = useTeamInsightsQuery(selectedTeam);

  // Auto-select first team if none selected
  useEffect(() => {
    if (isSignedIn && teams.length > 0 && !selectedTeam) {
      setSelectedTeam(teams[0].team_id);
    }
  }, [isSignedIn, teams, selectedTeam, setSelectedTeam]);

  const pageHeader = (
    <section className="flex items-center justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Your Teams
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Roster overview and team analysis.
        </p>
      </div>
      <Link href="/manage-teams">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Settings className="h-3.5 w-3.5" />
          Manage Teams
        </Button>
      </Link>
    </section>
  );

  if (!isLoaded || isTeamsLoading || (selectedTeam && isInsightsLoading)) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {pageHeader}
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-md" />
            ))}
          </div>
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-[400px] w-full rounded-md" />
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {pageHeader}
        <Card variant="panel" className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            Please sign in to view your teams.
          </p>
        </Card>
      </div>
    );
  }

  // A failed teams fetch is an error with Retry, not "connect your league".
  if (teamsError && teams.length === 0) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {pageHeader}
        <Card variant="panel">
          <QueryErrorState error={teamsError} onRetry={refetchTeams} />
        </Card>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {pageHeader}
        <ConnectTeamPrompt description="Add a team to see your roster, recent form, category strengths, and streaming targets." />
      </div>
    );
  }

  if (!selectedTeam) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {pageHeader}
        <Card variant="panel" className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            Select a team from the nav bar to view your roster.
          </p>
        </Card>
      </div>
    );
  }

  const teamName =
    selectedTeamData?.league_info?.team_name || "Team";
  const leagueName =
    selectedTeamData?.league_info?.league_name || "";

  return (
    <div className="space-y-4 animate-slide-up-fade">
      {pageHeader}

      {/* Team summary strip */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <span>
          <span className="text-foreground font-medium">{teamName}</span>
          {leagueName && <span> &middot; {leagueName}</span>}
          {league?.settings_synced && (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-primary/80">
              {scoringLabel(league)}
            </span>
          )}
        </span>
        <span className="ml-auto">
          {insights ? `${insights.roster.length} players` : ""}
        </span>
      </div>

      {insights ? (
        <TeamDashboard insights={insights} provider={provider} />
      ) : insightsError ? (
        <Card variant="panel">
          <QueryErrorState
            error={insightsError}
            onRetry={() => refetchInsights()}
            isRetrying={isInsightsFetching}
          />
        </Card>
      ) : (
        <Card variant="panel" className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            No roster data available.
          </p>
        </Card>
      )}
    </div>
  );
}
