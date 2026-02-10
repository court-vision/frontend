"use client";

import { useEffect, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useUIStore } from "@/stores/useUIStore";
import { useTeamsQuery, useTeamRosterQuery } from "@/hooks/useTeams";
import { RosterDisplay } from "@/components/teams-components/RosterDisplay";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { FantasyProvider } from "@/types/team";

export default function Teams() {
  const { isSignedIn, isLoaded } = useUser();
  const { selectedTeam, setSelectedTeam } = useUIStore();
  const { data: teams, isLoading: isTeamsLoading } = useTeamsQuery();
  const { data: roster, isLoading: isRosterLoading } =
    useTeamRosterQuery(selectedTeam);

  // Find the selected team's provider
  const provider = useMemo<FantasyProvider>(() => {
    if (!selectedTeam || !teams) return "espn";
    const team = teams.find((t) => t.team_id === selectedTeam);
    return team?.league_info?.provider || "espn";
  }, [selectedTeam, teams]);

  // Get team info for summary strip
  const selectedTeamData = useMemo(() => {
    if (!selectedTeam || !teams) return null;
    return teams.find((t) => t.team_id === selectedTeam);
  }, [selectedTeam, teams]);

  // Auto-select first team if none selected
  useEffect(() => {
    if (isSignedIn && teams && teams.length > 0 && !selectedTeam) {
      setSelectedTeam(teams[0].team_id);
    }
  }, [isSignedIn, teams, selectedTeam, setSelectedTeam]);

  const pageHeader = (
    <section>
      <h1 className="font-display text-xl font-bold tracking-tight">
        Your Teams
      </h1>
      <p className="text-muted-foreground text-xs mt-0.5">
        Roster overview and team analysis.
      </p>
    </section>
  );

  if (!isLoaded || isTeamsLoading || (selectedTeam && isRosterLoading)) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {pageHeader}
        <div className="space-y-3">
          <Skeleton className="h-8 w-full rounded-md" />
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

  if (!teams || teams.length === 0) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        {pageHeader}
        <Card variant="panel" className="p-8">
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              You don&apos;t have any teams yet.
            </p>
            <Link href="/manage-teams">
              <Button size="sm">Add a Team</Button>
            </Link>
          </div>
        </Card>
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
        </span>
        <span className="ml-auto">
          {roster ? `${roster.length} players` : ""}
        </span>
      </div>

      {roster && roster.length > 0 ? (
        <RosterDisplay roster={roster} provider={provider} />
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
