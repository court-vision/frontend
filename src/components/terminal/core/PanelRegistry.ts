import {
  User,
  LineChart,
  BarChart3,
  GitCompare,
  Table,
  Star,
  TrendingUp,
  Calendar,
} from "lucide-react";
import type { PanelDefinition } from "@/types/terminal";

// Panel registry - add new panel types here
export const PANEL_REGISTRY: PanelDefinition[] = [
  {
    id: "player-focus",
    name: "Player Focus",
    icon: User,
    category: "player",
    description: "Selected player card with quick stats",
    defaultSize: { width: 100, height: 50 },
  },
  {
    id: "advanced-stats",
    name: "Advanced Stats",
    icon: BarChart3,
    category: "player",
    description: "Advanced metrics: net rating, TS%, usage, PIE",
    defaultSize: { width: 100, height: 50 },
  },
  {
    id: "performance-chart",
    name: "Performance Chart",
    icon: LineChart,
    category: "player",
    description: "Fantasy points line chart with moving averages",
    defaultSize: { width: 100, height: 100 },
  },
  {
    id: "game-log",
    name: "Game Log",
    icon: Table,
    category: "player",
    description: "Sortable game-by-game stats table",
    defaultSize: { width: 100, height: 100 },
  },
  {
    id: "comparison",
    name: "Comparison",
    icon: GitCompare,
    category: "comparison",
    description: "Compare 2-4 players side by side",
    defaultSize: { width: 100, height: 100 },
  },
  {
    id: "watchlist",
    name: "Watchlist",
    icon: Star,
    category: "market",
    description: "Your saved players",
    defaultSize: { width: 100, height: 100 },
  },
  {
    id: "trending",
    name: "Trending",
    icon: TrendingUp,
    category: "market",
    description: "Players with rising/falling ownership",
    defaultSize: { width: 100, height: 100 },
  },
  {
    id: "schedule",
    name: "Schedule",
    icon: Calendar,
    category: "schedule",
    description: "Today's games and upcoming schedule",
    defaultSize: { width: 100, height: 100 },
  },
];

// Helper functions
export function getPanelDefinition(id: string): PanelDefinition | undefined {
  return PANEL_REGISTRY.find((panel) => panel.id === id);
}

export function getPanelsByCategory(
  category: PanelDefinition["category"]
): PanelDefinition[] {
  return PANEL_REGISTRY.filter((panel) => panel.category === category);
}

export function getAllPanelIds(): string[] {
  return PANEL_REGISTRY.map((panel) => panel.id);
}
