import type { LayoutItem } from "react-grid-layout";
import type { LucideIcon } from "lucide-react";

/** A single widget slot in the grid — extends RGL LayoutItem with our definition mapping */
export interface DashboardWidgetItem extends LayoutItem {
  // i: string — widget instance ID (from LayoutItem)
  // x, y, w, h — grid position (from LayoutItem)
  definitionId: string;
}

/** Per-team layout shape */
export interface DashboardLayout {
  widgets: DashboardWidgetItem[];
  cols: number; // always 12
}

/** All layouts keyed by teamId string or "default" */
export interface DashboardLayouts {
  [teamKey: string]: DashboardLayout;
}

/** Widget definition in the dashboard registry */
export interface DashboardWidgetDefinition {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: "team" | "market" | "schedule" | "utility";
  defaultW: number;
  defaultH: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  requiresTeam: boolean;
}

/** Dashboard Zustand store shape */
export interface DashboardState {
  layouts: DashboardLayouts;
  isEditMode: boolean;

  setLayout: (teamKey: string, layout: DashboardLayout) => void;
  resetLayout: (teamKey: string) => void;
  toggleEditMode: () => void;
  addWidget: (teamKey: string, definitionId: string) => void;
  removeWidget: (teamKey: string, instanceId: string) => void;
}
