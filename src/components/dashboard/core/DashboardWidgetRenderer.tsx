"use client";

import {
  MatchupPanel,
  RosterOverviewPanel,
  DailyBreakdownPanel,
  ScoreHistoryPanel,
  StreamersPanel,
  TodayLeadersPanel,
  SchedulePanel,
  TrendingPanel,
  WatchlistPanel,
  CategoryStrengthsPanel,
  TeamStreamersPanel,
} from "@/components/terminal/panels";
import { QuickActionsWidget } from "../widgets/QuickActionsWidget";

interface DashboardWidgetRendererProps {
  definitionId: string;
}

export function DashboardWidgetRenderer({
  definitionId,
}: DashboardWidgetRendererProps) {
  switch (definitionId) {
    case "matchup-score":
      return <MatchupPanel />;
    case "roster-overview":
      return <RosterOverviewPanel />;
    case "daily-breakdown":
      return <DailyBreakdownPanel />;
    case "score-history":
      return <ScoreHistoryPanel />;
    case "streamers":
      return <StreamersPanel />;
    case "today-leaders":
      return <TodayLeadersPanel />;
    case "schedule":
      return <SchedulePanel />;
    case "trending":
      return <TrendingPanel />;
    case "watchlist":
      return <WatchlistPanel />;
    case "category-strengths":
      return <CategoryStrengthsPanel />;
    case "team-streamers":
      return <TeamStreamersPanel />;
    case "quick-actions":
      return <QuickActionsWidget />;
    default:
      return (
        <div className="flex items-center justify-center h-full">
          <span className="text-xs text-muted-foreground">
            Unknown widget: {definitionId}
          </span>
        </div>
      );
  }
}
