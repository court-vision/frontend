"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useUIStore } from "@/stores/useUIStore";
import { useTeamsQuery, useTeamRosterQuery } from "@/hooks/useTeams";
import { RosterDisplay } from "@/components/teams-components/RosterDisplay";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export default function Teams() {
  const { isSignedIn, isLoaded } = useUser();
  const { selectedTeam, setSelectedTeam } = useUIStore();
  const { data: teams, isLoading: isTeamsLoading } = useTeamsQuery();
  const { data: roster, isLoading: isRosterLoading } =
    useTeamRosterQuery(selectedTeam);

  // Auto-select first team if none selected
  useEffect(() => {
    if (isSignedIn && teams && teams.length > 0 && !selectedTeam) {
      setSelectedTeam(teams[0].team_id);
    }
  }, [isSignedIn, teams, selectedTeam, setSelectedTeam]);

  if (!isLoaded) {
    return (
      <>
        <div className="flex items-center mb-4">
          <h1 className="text-lg font-semibold md:text-2xl">Your Teams</h1>
        </div>
        <div className="space-y-4 w-full max-w-7xl mx-auto">
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </>
    );
  }

  if (!isSignedIn) {
    return (
      <>
        <div className="flex items-center mb-4">
          <h1 className="text-lg font-semibold md:text-2xl">Your Teams</h1>
        </div>
        <div className="flex flex-1 justify-center rounded-lg border border-primary border-dashed shadow-sm p-8">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-sm text-gray-500">You are not logged in.</p>
            <p className="text-sm text-gray-500">
              Please login to view your teams.
            </p>
          </div>
        </div>
      </>
    );
  }

  if (isTeamsLoading || (selectedTeam && isRosterLoading)) {
    return (
      <>
        <div className="flex items-center mb-4">
          <h1 className="text-lg font-semibold md:text-2xl">Your Teams</h1>
        </div>
        <div className="space-y-4 w-full max-w-7xl mx-auto">
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </>
    );
  }

  if (!teams || teams.length === 0) {
    return (
      <>
        <div className="flex items-center mb-4">
          <h1 className="text-lg font-semibold md:text-2xl">Your Teams</h1>
        </div>
        <div className="flex flex-1 justify-center rounded-lg border border-primary border-dashed shadow-sm p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <p>You don&apos;t have any teams yet.</p>
            <Link
              href="/manage-teams"
              className="text-blue-500 hover:underline"
            >
              Add a team
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (!selectedTeam) {
    return (
      <>
        <div className="flex items-center mb-4">
          <h1 className="text-lg font-semibold md:text-2xl">Your Teams</h1>
        </div>
        <div className="flex flex-1 justify-center items-center p-8 border border-dashed rounded-lg">
          <p>Please select a team from the menu.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center mb-4">
        <h1 className="text-lg font-semibold md:text-2xl">Your Teams</h1>
      </div>

      <div className="flex flex-1 justify-center rounded-lg border border-primary border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center w-full">
          {roster && roster.length > 0 ? (
            <div className="flex flex-wrap justify-center items-center gap-6 relative z-10 py-10 w-full max-w-7xl mx-auto px-4">
              <RosterDisplay roster={roster} />
            </div>
          ) : (
            <div className="p-10">
              <p>No roster data available.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
