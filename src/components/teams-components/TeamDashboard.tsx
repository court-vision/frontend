"use client";

import type { TeamInsightsData } from "@/types/team-insights";
import type { FantasyProvider } from "@/types/team";
import { AnalyticsCardGrid } from "./analytics/AnalyticsCards";
import { WeekScheduleStrip } from "./WeekScheduleStrip";
import { RosterDisplay } from "./RosterDisplay";

interface TeamDashboardProps {
  insights: TeamInsightsData;
  provider?: FantasyProvider;
}

export function TeamDashboard({ insights, provider }: TeamDashboardProps) {
  return (
    <div className="space-y-4">
      {/* Analytics overview cards */}
      <AnalyticsCardGrid insights={insights} />

      {/* Week schedule strip */}
      {insights.schedule_overview && (
        <WeekScheduleStrip
          roster={insights.roster}
          scheduleOverview={insights.schedule_overview}
        />
      )}

      {/* Enriched roster table */}
      {insights.roster.length > 0 && (
        <RosterDisplay roster={insights.roster} provider={provider} />
      )}
    </div>
  );
}
