"use client";

import { useEffect, useState } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useDashboardStore } from "@/stores/useDashboardStore";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import { ConnectTeamPrompt } from "@/components/teams-components/ConnectTeamPrompt";
import { DEFAULT_LAYOUTS, layoutTemplateFor } from "./defaultLayouts";
import { DashboardGrid } from "./DashboardGrid";
import { DashboardToolbar } from "./DashboardToolbar";
import { WidgetCatalog } from "./WidgetCatalog";

export function DashboardView() {
  const { selectedTeam, dismissedConnectPrompt, setDismissedConnectPrompt } = useUIStore();
  const { setFocusedTeam } = useTerminalStore();
  const { layouts, setLayout } = useDashboardStore();
  const { format, teams, isLoading: isTeamsLoading } = useSelectedTeam();
  const [catalogOpen, setCatalogOpen] = useState(false);

  // Derive the team key for layout lookup
  const teamKey = selectedTeam !== null ? String(selectedTeam) : "default";
  const template = layoutTemplateFor(selectedTeam, format);

  // Sync selectedTeam → focusedTeamId so terminal panel components get the right context
  useEffect(() => {
    setFocusedTeam(selectedTeam);
  }, [selectedTeam, setFocusedTeam]);

  // Seed default layout if this teamKey has never been customized.
  // Wait for teams to load so a category league seeds the category template.
  useEffect(() => {
    if (layouts[teamKey] || (selectedTeam !== null && isTeamsLoading)) return;
    const source = DEFAULT_LAYOUTS[template];
    const seeded = {
      ...source,
      widgets: source.widgets.map((w) => ({
        ...w,
        i: crypto.randomUUID(),
      })),
    };
    setLayout(teamKey, seeded);
  }, [teamKey, layouts, setLayout, selectedTeam, template, isTeamsLoading]);

  const widgets = layouts[teamKey]?.widgets ?? [];
  const showConnectPrompt =
    !isTeamsLoading && teams.length === 0 && !dismissedConnectPrompt;

  return (
    <div className="flex flex-col h-full">
      <DashboardToolbar
        teamKey={teamKey}
        template={template}
        onOpenCatalog={() => setCatalogOpen(true)}
      />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {showConnectPrompt && (
          <ConnectTeamPrompt
            variant="banner"
            description="Connect your ESPN or Yahoo team to get matchup, roster, and streamer widgets on this dashboard."
            onDismiss={() => setDismissedConnectPrompt(true)}
          />
        )}
        <DashboardGrid teamKey={teamKey} widgets={widgets} />
      </div>
      <WidgetCatalog
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        teamKey={teamKey}
      />
    </div>
  );
}
