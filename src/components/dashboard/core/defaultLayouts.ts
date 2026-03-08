import type { DashboardLayout } from "@/types/dashboard";

/** Default layout for users without a selected team (or logged-out) */
const DEFAULT_LAYOUT: DashboardLayout = {
  cols: 12,
  widgets: [
    // Row 1: Leaders + Schedule + Trending
    {
      i: "default-leaders",
      definitionId: "today-leaders",
      x: 0,
      y: 0,
      w: 5,
      h: 5,
      minW: 3,
      minH: 4,
    },
    {
      i: "default-schedule",
      definitionId: "schedule",
      x: 5,
      y: 0,
      w: 4,
      h: 5,
      minW: 2,
      minH: 4,
    },
    {
      i: "default-trending",
      definitionId: "trending",
      x: 9,
      y: 0,
      w: 3,
      h: 5,
      minW: 2,
      minH: 3,
    },
    // Row 2: Streamers + Watchlist + Quick Actions
    {
      i: "default-streamers",
      definitionId: "streamers",
      x: 0,
      y: 5,
      w: 5,
      h: 5,
      minW: 2,
      minH: 4,
    },
    {
      i: "default-watchlist",
      definitionId: "watchlist",
      x: 5,
      y: 5,
      w: 4,
      h: 5,
      minW: 2,
      minH: 3,
    },
    {
      i: "default-actions",
      definitionId: "quick-actions",
      x: 9,
      y: 5,
      w: 3,
      h: 2,
      minW: 2,
      minH: 2,
    },
  ],
};

/** Default layout template when a team is selected */
const TEAM_LAYOUT: DashboardLayout = {
  cols: 12,
  widgets: [
    // Top row: Matchup score + Roster + Team Streamers
    {
      i: "team-matchup",
      definitionId: "matchup-score",
      x: 0,
      y: 0,
      w: 5,
      h: 5,
      minW: 3,
      minH: 3,
    },
    {
      i: "team-roster",
      definitionId: "roster-overview",
      x: 5,
      y: 0,
      w: 4,
      h: 7,
      minW: 3,
      minH: 4,
    },
    {
      i: "team-streamers",
      definitionId: "team-streamers",
      x: 9,
      y: 0,
      w: 3,
      h: 5,
      minW: 2,
      minH: 4,
    },
    // Second row: Daily breakdown + Score history
    {
      i: "team-daily",
      definitionId: "daily-breakdown",
      x: 0,
      y: 5,
      w: 5,
      h: 4,
      minW: 3,
      minH: 3,
    },
    {
      i: "team-history",
      definitionId: "score-history",
      x: 9,
      y: 5,
      w: 3,
      h: 4,
      minW: 2,
      minH: 3,
    },
  ],
};

export const DEFAULT_LAYOUTS: Record<string, DashboardLayout> = {
  default: DEFAULT_LAYOUT,
  team: TEAM_LAYOUT,
};
