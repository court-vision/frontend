"use client";

import { useMemo } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { useTeamsQuery } from "@/hooks/useTeams";
import { DEFAULT_9CAT } from "@/lib/category-format";
import { toScoringFormat } from "@/types/scoring";
import type { CategoryDef, ScoringFormat } from "@/types/scoring";
import type { FantasyProvider, LeagueSummary, TeamResponseData } from "@/types/team";

export interface SelectedTeamState {
  teamId: number | null;
  team: TeamResponseData | null;
  teams: TeamResponseData[];
  league: LeagueSummary | null;
  provider: FantasyProvider;
  /** What the UI should render — points unless a synced categories league. */
  format: ScoringFormat;
  /** League categories when in categories format, otherwise the standard 9-cat. */
  categories: CategoryDef[];
  isCategories: boolean;
  settingsSynced: boolean;
  isLoading: boolean;
  /** Set when the teams query failed — "couldn't load teams" is not "no teams". */
  teamsError: Error | null;
  refetchTeams: () => void;
}

/**
 * The selected team (from the UI store) resolved against the teams query,
 * with its league/scoring format derived once. Pass a team id to resolve a
 * specific team instead of the globally selected one.
 */
export function useSelectedTeam(teamIdOverride?: number | null): SelectedTeamState {
  const selected = useUIStore((s) => s.selectedTeam);
  const teamId = teamIdOverride === undefined ? selected : teamIdOverride;
  const { data: teams, isLoading, error: teamsError, refetch } = useTeamsQuery();

  return useMemo(() => {
    const list = teams ?? [];
    const team =
      teamId !== null && teamId !== undefined
        ? list.find((t) => t.team_id === teamId) ?? null
        : null;
    const league = team?.league ?? null;
    const provider: FantasyProvider = team?.league_info?.provider ?? "espn";
    const settingsSynced = league?.settings_synced ?? false;
    const format = toScoringFormat(league?.scoring_type, settingsSynced);
    const categories =
      format === "categories" && league?.categories?.length
        ? league.categories
        : DEFAULT_9CAT;
    return {
      teamId: teamId ?? null,
      team,
      teams: list,
      league,
      provider,
      format,
      categories,
      isCategories: format === "categories",
      settingsSynced,
      isLoading,
      teamsError,
      refetchTeams: refetch,
    };
  }, [teamId, teams, isLoading, teamsError, refetch]);
}

export function useScoringFormat(teamId?: number | null): ScoringFormat {
  return useSelectedTeam(teamId).format;
}
