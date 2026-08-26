"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-error";
import { ConnectTeamPrompt } from "@/components/teams-components/ConnectTeamPrompt";
import {
  useSyncTeamLeagueMutation,
  useTeamLeagueQuery,
  useTeamsQuery,
} from "@/hooks/useTeams";
import { useUIStore } from "@/stores/useUIStore";
import { cn } from "@/lib/utils";
import { LeagueFormatCard } from "./LeagueFormatCard";

/**
 * Settings → League: per-team scoring format detected from ESPN/Yahoo, with
 * categories/point weights, roster, schedule, parser warnings, and re-sync.
 */
export function LeagueSettings() {
  const {
    data: teams = [],
    isLoading,
    error: teamsError,
    refetch: refetchTeams,
    isFetching: teamsFetching,
  } = useTeamsQuery();
  const selectedTeam = useUIStore((s) => s.selectedTeam);
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null);

  const preferred = activeTeamId ?? selectedTeam;
  const teamId =
    preferred !== null && teams.some((t) => t.team_id === preferred)
      ? preferred
      : teams[0]?.team_id ?? null;
  const team = teams.find((t) => t.team_id === teamId) ?? null;

  const {
    data: league,
    isLoading: leagueLoading,
    error: leagueError,
    refetch: refetchLeague,
    isFetching: leagueFetching,
  } = useTeamLeagueQuery(teamId);
  const sync = useSyncTeamLeagueMutation();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64 rounded-full" />
        <Skeleton className="h-48 w-full rounded-md" />
      </div>
    );
  }

  // A failed teams fetch is an error with Retry, not "connect a team".
  if (teamsError && teams.length === 0) {
    return (
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">League</h3>
          <p className="text-muted-foreground text-sm mt-0.5">
            Scoring format detected from your league settings.
          </p>
        </div>
        <QueryErrorState
          error={teamsError}
          onRetry={() => refetchTeams()}
          isRetrying={teamsFetching}
          className="rounded-md border border-border/60"
        />
      </div>
    );
  }

  if (!teams.length || !team || teamId === null) {
    return (
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">League</h3>
          <p className="text-muted-foreground text-sm mt-0.5">
            Scoring format detected from your league settings.
          </p>
        </div>
        <ConnectTeamPrompt
          variant="card"
          className="p-6"
          description="Connect a team and we'll detect whether your league scores by points or categories."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">League</h3>
        <p className="text-muted-foreground text-sm mt-0.5">
          Scoring format detected from your league settings. Re-sync after your commissioner changes scoring.
        </p>
      </div>

      {/* Team strip */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {teams.map((t) => {
          const name = t.league_info.team_name;
          const displayName = name.length > 20 ? name.slice(0, 20) + "..." : name;
          const isActive = t.team_id === teamId;
          return (
            <button
              key={t.team_id}
              onClick={() => setActiveTeamId(t.team_id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  t.league_info.provider === "yahoo" ? "bg-purple-500" : "bg-orange-500"
                )}
              />
              {displayName}
            </button>
          );
        })}
      </div>

      {leagueError && !league ? (
        <QueryErrorState
          error={leagueError}
          onRetry={() => refetchLeague()}
          isRetrying={leagueFetching}
          compact
          className="rounded-md border border-border/60"
        />
      ) : (
        <LeagueFormatCard
          key={teamId}
          team={team}
          league={league ?? null}
          isLoading={leagueLoading}
          onSync={() => sync.mutate(teamId)}
          isSyncing={sync.isPending && sync.variables === teamId}
        />
      )}
    </div>
  );
}
