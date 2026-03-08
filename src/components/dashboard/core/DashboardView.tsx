"use client";

import { useEffect, useState } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useDashboardStore } from "@/stores/useDashboardStore";
import { DEFAULT_LAYOUTS } from "./defaultLayouts";
import { DashboardGrid } from "./DashboardGrid";
import { DashboardToolbar } from "./DashboardToolbar";
import { WidgetCatalog } from "./WidgetCatalog";

export function DashboardView() {
  const { selectedTeam } = useUIStore();
  const { setFocusedTeam } = useTerminalStore();
  const { layouts, setLayout } = useDashboardStore();
  const [catalogOpen, setCatalogOpen] = useState(false);

  // Derive the team key for layout lookup
  const teamKey = selectedTeam !== null ? String(selectedTeam) : "default";

  // Sync selectedTeam → focusedTeamId so terminal panel components get the right context
  useEffect(() => {
    setFocusedTeam(selectedTeam);
  }, [selectedTeam, setFocusedTeam]);

  // Seed default layout if this teamKey has never been customized
  useEffect(() => {
    if (!layouts[teamKey]) {
      const template =
        selectedTeam !== null
          ? DEFAULT_LAYOUTS["team"]
          : DEFAULT_LAYOUTS["default"];
      const seeded = {
        ...template,
        widgets: template.widgets.map((w) => ({
          ...w,
          i: crypto.randomUUID(),
        })),
      };
      setLayout(teamKey, seeded);
    }
  }, [teamKey, layouts, setLayout, selectedTeam]);

  const widgets = layouts[teamKey]?.widgets ?? [];

  return (
    <div className="flex flex-col h-full">
      <DashboardToolbar
        teamKey={teamKey}
        onOpenCatalog={() => setCatalogOpen(true)}
      />
      <div className="flex-1 overflow-y-auto p-4">
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
