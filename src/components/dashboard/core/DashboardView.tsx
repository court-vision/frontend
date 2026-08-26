"use client";

import { useEffect, useState } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useDashboardStore } from "@/stores/useDashboardStore";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { orderForMobile } from "@/lib/dashboard-order";
import { ConnectTeamPrompt } from "@/components/teams-components/ConnectTeamPrompt";
import {
  DEFAULT_LAYOUTS,
  MOBILE_ORDER,
  layoutTemplateFor,
} from "./defaultLayouts";
import { DashboardGrid } from "./DashboardGrid";
import { DashboardStack } from "./DashboardStack";
import { DashboardToolbar } from "./DashboardToolbar";
import { WidgetCatalog } from "./WidgetCatalog";

export function DashboardView() {
  const { selectedTeam, dismissedConnectPrompt, setDismissedConnectPrompt } = useUIStore();
  const { setFocusedTeam } = useTerminalStore();
  const { layouts, setLayout } = useDashboardStore();
  const { format, teams, isLoading: isTeamsLoading } = useSelectedTeam();
  const [catalogOpen, setCatalogOpen] = useState(false);
  // Safe to branch on: `Base` withholds the page until Clerk has loaded, so
  // the media query has hydrated before this mounts (no desktop flash).
  const isMobile = useIsMobile();

  // Derive the team key for layout lookup
  const teamKey = selectedTeam !== null ? String(selectedTeam) : "default";
  const template = layoutTemplateFor(selectedTeam, format);

  // Sync selectedTeam → focusedTeamId so terminal panel components get the right context
  useEffect(() => {
    setFocusedTeam(selectedTeam);
  }, [selectedTeam, setFocusedTeam]);

  // Seed default layout if this teamKey has never been customized.
  // Wait for teams to load so a category league seeds the category template.
  // The phone stack never writes the persisted store — it renders the
  // template directly until a desktop session seeds it.
  useEffect(() => {
    if (isMobile) return;
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
  }, [isMobile, teamKey, layouts, setLayout, selectedTeam, template, isTeamsLoading]);

  const widgets =
    layouts[teamKey]?.widgets ??
    (isMobile ? DEFAULT_LAYOUTS[template].widgets : []);
  const showConnectPrompt =
    !isTeamsLoading && teams.length === 0 && !dismissedConnectPrompt;

  return (
    <div className="flex flex-col h-full">
      <DashboardToolbar
        teamKey={teamKey}
        template={template}
        onOpenCatalog={() => setCatalogOpen(true)}
        readOnly={isMobile}
      />
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4">
        {showConnectPrompt && (
          <ConnectTeamPrompt
            variant="banner"
            description="Connect your ESPN or Yahoo team to get matchup, roster, and streamer widgets on this dashboard."
            onDismiss={() => setDismissedConnectPrompt(true)}
          />
        )}
        {isMobile ? (
          <DashboardStack
            teamKey={teamKey}
            widgets={orderForMobile(widgets, MOBILE_ORDER[template])}
          />
        ) : (
          <DashboardGrid teamKey={teamKey} widgets={widgets} />
        )}
      </div>
      <WidgetCatalog
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        teamKey={teamKey}
      />
    </div>
  );
}
