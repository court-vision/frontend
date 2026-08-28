"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
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

/**
 * Shown when a team's dashboard has no widgets.
 *
 * A layout persisted with an empty `widgets` array is a dead end otherwise: the
 * seeding effect skips it (the key exists, so it looks customised) and the grid
 * renders nothing. Add Widget and Reset live behind the toolbar's edit toggle,
 * so from here there is no discoverable way back — which is exactly what
 * happened to team 20.
 */
function DashboardEmptyState({
  onAddWidget,
  onReset,
}: {
  onAddWidget: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/60 bg-muted/10 py-16 text-center">
      <LayoutGrid className="h-6 w-6 text-muted-foreground/60" />
      <div className="space-y-1">
        <p className="text-sm font-medium">This dashboard has no widgets</p>
        <p className="text-xs text-muted-foreground">
          Add the ones you want, or restore the default layout for this team.
        </p>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={onAddWidget} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add widgets
        </Button>
        <Button size="sm" variant="outline" onClick={onReset} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to default
        </Button>
      </div>
    </div>
  );
}

export function DashboardView() {
  const { selectedTeam, dismissedConnectPrompt, setDismissedConnectPrompt } = useUIStore();
  const { setFocusedTeam } = useTerminalStore();
  const { layouts, setLayout, resetLayout } = useDashboardStore();
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
        {widgets.length === 0 && !isMobile ? (
          <DashboardEmptyState
            onAddWidget={() => setCatalogOpen(true)}
            onReset={() => resetLayout(teamKey, template)}
          />
        ) : isMobile ? (
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
