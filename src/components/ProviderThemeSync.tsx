"use client";

import { useEffect } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { useTeams } from "@/app/context/TeamsContext";
import type { FantasyProvider } from "@/types/team";

/**
 * Syncs the selected team's provider to the document root for CSS theming.
 * When a Yahoo team is selected, the theme changes to purple.
 * When an ESPN team is selected (or no team), the theme is orange.
 */
export function ProviderThemeSync() {
  const selectedTeam = useUIStore((state) => state.selectedTeam);
  const { teams } = useTeams();

  useEffect(() => {
    // Find selected team and get its provider
    const team = teams.find((t) => t.team_id === selectedTeam);
    const provider: FantasyProvider = team?.league_info?.provider || "espn";

    // Only update if provider actually changed to avoid infinite loops
    const currentProvider = useUIStore.getState().selectedProvider;
    if (currentProvider !== provider) {
      useUIStore.getState().setSelectedProvider(provider);
    }

    // Update document attribute for CSS theming
    document.documentElement.setAttribute("data-provider", provider);
  }, [selectedTeam, teams]);

  // This component doesn't render anything
  return null;
}
