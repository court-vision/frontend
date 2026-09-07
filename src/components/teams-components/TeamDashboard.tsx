"use client";

import type { TeamInsightsData } from "@/types/team-insights";
import type { FantasyProvider } from "@/types/team";
import { AnalyticsCardGrid } from "./analytics/AnalyticsCards";
import { WeekScheduleStrip } from "./WeekScheduleStrip";
import { RosterDisplay } from "./RosterDisplay";
import {
  LineupEditorProviderIfEspn,
  type LineupEditorMock,
} from "@/components/lineup/LineupEditorProvider";
import { LineupEditor } from "@/components/lineup/LineupEditor";
import { LineupApplyBar } from "@/components/lineup/LineupApplyBar";
import { ApplyLineupDialog } from "@/components/lineup/ApplyLineupDialog";

interface TeamDashboardProps {
  insights: TeamInsightsData;
  /** Court Vision team id — the lineup editor's board is fetched for it. */
  teamId: number;
  provider?: FantasyProvider;
  /** Dev-only fixture board (`/your-teams?mock=lineup`). */
  lineupMock?: LineupEditorMock;
}

export function TeamDashboard({ insights, teamId, provider = "espn", lineupMock }: TeamDashboardProps) {
  return (
    <LineupEditorProviderIfEspn teamId={teamId} provider={provider} mock={lineupMock}>
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

        {/* Today's ESPN lineup: tap-to-move board + staged moves + confirm */}
        {provider === "espn" && (
          <>
            <LineupEditor />
            <LineupApplyBar />
            <ApplyLineupDialog />
          </>
        )}

        {/* Enriched roster table */}
        {insights.roster.length > 0 && (
          <RosterDisplay roster={insights.roster} provider={provider} valueKind={insights.value_kind} />
        )}
      </div>
    </LineupEditorProviderIfEspn>
  );
}
