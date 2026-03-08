import { Activity, Heart, BarChart3, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import type {
  TeamInsightsData,
  RosterHealthSummary,
  CategoryStrengths,
  ScheduleOverview,
} from "@/types/team-insights";
import { cn } from "@/lib/utils";

// --- ProjectedPointsCard ---

function ProjectedPointsCard({
  projectedFpts,
}: {
  projectedFpts: number | null;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Projected This Week
        </span>
      </div>
      <p className="text-lg font-bold font-mono tabular-nums">
        {projectedFpts !== null ? projectedFpts.toFixed(1) : "--"}
      </p>
    </Card>
  );
}

// --- RosterHealthCard ---

function RosterHealthCard({ health }: { health: RosterHealthSummary }) {
  const indicators = [
    { label: "Healthy", count: health.healthy, color: "bg-green-500" },
    { label: "GTD", count: health.game_time_decision, color: "bg-yellow-500" },
    { label: "DTD", count: health.day_to_day, color: "bg-orange-500" },
    { label: "Out", count: health.out, color: "bg-red-500" },
  ];

  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Heart className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Roster Health</span>
      </div>
      <div className="flex items-center gap-3">
        {indicators.map((ind) => (
          <div key={ind.label} className="flex items-center gap-1">
            <span
              className={cn("inline-block h-2 w-2 rounded-full", ind.color)}
            />
            <span className="text-xs font-mono tabular-nums">{ind.count}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// --- CategoryStrengthsCard ---

const CATEGORY_KEYS: { label: string; key: keyof CategoryStrengths }[] = [
  { label: "PTS", key: "avg_points" },
  { label: "REB", key: "avg_rebounds" },
  { label: "AST", key: "avg_assists" },
  { label: "STL", key: "avg_steals" },
  { label: "BLK", key: "avg_blocks" },
  { label: "TOV", key: "avg_turnovers" },
  { label: "FG%", key: "avg_fg_pct" },
  { label: "FT%", key: "avg_ft_pct" },
];

function CategoryStrengthsCard({
  strengths,
}: {
  strengths: CategoryStrengths | null;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Category Averages</span>
      </div>
      {strengths ? (
        <div className="grid grid-cols-4 gap-x-3 gap-y-1">
          {CATEGORY_KEYS.map(({ label, key }) => (
            <div key={key} className="flex items-baseline justify-between">
              <span className="text-[11px] text-muted-foreground">{label}</span>
              <span className="text-xs font-mono tabular-nums">
                {strengths[key].toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">--</p>
      )}
    </Card>
  );
}

// --- ScheduleOverviewCard ---

function ScheduleOverviewCard({
  overview,
}: {
  overview: ScheduleOverview | null;
}) {
  if (!overview) {
    return (
      <Card className="p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Schedule</span>
        </div>
        <p className="text-xs text-muted-foreground">--</p>
      </Card>
    );
  }

  const maxGames = Math.max(...overview.day_game_counts, 1);

  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Week {overview.matchup_number}
        </span>
      </div>
      <p className="text-lg font-bold font-mono tabular-nums leading-tight">
        {overview.total_team_games}{" "}
        <span className="text-xs font-normal text-muted-foreground">
          games
        </span>
      </p>
      <div className="flex items-center gap-0.5 mt-2">
        {overview.day_game_counts.map((count, i) => (
          <div
            key={i}
            className={cn(
              "h-4 flex-1 rounded-sm",
              i === overview.current_day_index
                ? "ring-1 ring-primary ring-offset-1 ring-offset-background"
                : ""
            )}
            style={{
              backgroundColor: `hsl(var(--primary) / ${count > 0 ? 0.2 + (count / maxGames) * 0.8 : 0.05})`,
            }}
          />
        ))}
      </div>
      {overview.teams_with_b2b.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {overview.teams_with_b2b.length} B2B
        </p>
      )}
    </Card>
  );
}

// --- AnalyticsCardGrid (container) ---

export default function AnalyticsCardGrid({
  insights,
}: {
  insights: TeamInsightsData;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <ProjectedPointsCard projectedFpts={insights.projected_week_fpts} />
      <RosterHealthCard health={insights.roster_health} />
      <CategoryStrengthsCard strengths={insights.category_strengths} />
      <ScheduleOverviewCard overview={insights.schedule_overview} />
    </div>
  );
}

export {
  ProjectedPointsCard,
  RosterHealthCard,
  CategoryStrengthsCard,
  ScheduleOverviewCard,
  AnalyticsCardGrid,
};
