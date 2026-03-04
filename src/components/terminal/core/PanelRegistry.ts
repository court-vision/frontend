import {
  User,
  LineChart,
  BarChart3,
  GitCompare,
  Table,
  Star,
  TrendingUp,
  Calendar,
  Users,
  Zap,
  CalendarDays,
  Shield,
  List,
  Swords,
  PieChart,
  AreaChart,
  LayoutGrid,
  Sparkles,
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
  {
    id: "today-leaders",
    name: "Today's Leaders",
    icon: Users,
    category: "market",
    description: "Live fantasy point leaderboard for today's games",
    defaultSize: { width: 100, height: 100 },
  },
  {
    id: "streamers",
    name: "Streamers",
    icon: Zap,
    category: "market",
    description: "Breakout pickup candidates from injury opportunities",
    defaultSize: { width: 100, height: 100 },
  },
  {
    id: "team-schedule",
    name: "Team Schedule",
    icon: CalendarDays,
    category: "player",
    description: "Player's team upcoming and recent games with opponent difficulty",
    defaultSize: { width: 100, height: 100 },
  },
  {
    id: "matchup-context",
    name: "Matchup Context",
    icon: Shield,
    category: "player",
    description: "Upcoming opponent difficulty analysis sorted by defensive rating",
    defaultSize: { width: 100, height: 100 },
  },
  // Team panels
  {
    id: "roster-overview",
    name: "Roster Overview",
    icon: List,
    category: "team",
    description: "Full roster with avg FPTS, L5/L14 trends, and injury badges",
    defaultSize: { width: 100, height: 100 },
  },
  {
    id: "matchup",
    name: "Matchup",
    icon: Swords,
    category: "team",
    description: "Live matchup score vs opponent with per-player projections",
    defaultSize: { width: 100, height: 100 },
  },
  {
    id: "category-strengths",
    name: "Category Strengths",
    icon: PieChart,
    category: "team",
    description: "Your team vs opponent category comparison bars",
    defaultSize: { width: 100, height: 100 },
  },
  {
    id: "score-history",
    name: "Score History",
    icon: AreaChart,
    category: "team",
    description: "Daily matchup score chart across the current period",
    defaultSize: { width: 100, height: 100 },
  },
  {
    id: "daily-breakdown",
    name: "Daily Breakdown",
    icon: LayoutGrid,
    category: "team",
    description: "Day-by-day matchup grid with live scores and projections",
    defaultSize: { width: 100, height: 100 },
  },
  {
    id: "lineup-optimizer",
    name: "Lineup Optimizer",
    icon: Zap,
    category: "team",
    description: "Embedded lineup generation for the focused team",
    defaultSize: { width: 100, height: 100 },
  },
  {
    id: "team-streamers",
    name: "Team Streamers",
    icon: Sparkles,
    category: "team",
    description: "Streaming pickups contextualized to team category weaknesses",
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
