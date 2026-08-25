"use client";

import { useEffect } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";

/**
 * Syncs the selected team's provider to the document root for CSS theming.
 * When a Yahoo team is selected, the theme changes to purple.
 * When an ESPN team is selected (or no team), the theme is orange.
 */
export function ProviderThemeSync() {
  const { provider } = useSelectedTeam();

  useEffect(() => {
    // Only update if provider actually changed to avoid infinite loops
    const currentProvider = useUIStore.getState().selectedProvider;
    if (currentProvider !== provider) {
      useUIStore.getState().setSelectedProvider(provider);
    }

    // Update document attribute for CSS theming
    document.documentElement.setAttribute("data-provider", provider);
  }, [provider]);

  // This component doesn't render anything
  return null;
}
