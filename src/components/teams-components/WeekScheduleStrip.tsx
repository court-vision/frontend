"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  EnrichedRosterPlayer,
  ScheduleOverview,
} from "@/types/team-insights";

interface WeekScheduleStripProps {
  roster: EnrichedRosterPlayer[];
  scheduleOverview: ScheduleOverview;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getLastName(fullName: string): string {
  const parts = fullName.trim().split(" ");
  return parts[parts.length - 1];
}

function formatDate(startDate: string, dayIndex: number): string {
  const date = new Date(startDate + "T00:00:00");
  date.setDate(date.getDate() + dayIndex);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getDayName(startDate: string, dayIndex: number): string {
  const date = new Date(startDate + "T00:00:00");
  date.setDate(date.getDate() + dayIndex);
  return DAY_NAMES[date.getDay()];
}

export function WeekScheduleStrip({
  roster,
  scheduleOverview,
}: WeekScheduleStripProps) {
  const { matchup_start, current_day_index, game_span } = scheduleOverview;

  // Build a map of day index -> players playing that day
  const dayPlayers: Map<number, EnrichedRosterPlayer[]> = new Map();
  for (let d = 0; d < game_span; d++) {
    dayPlayers.set(d, []);
  }

  for (const player of roster) {
    if (!player.schedule) continue;
    for (const dayIdx of player.schedule.game_days) {
      dayPlayers.get(dayIdx)?.push(player);
    }
  }

  // Determine B2B days: days where at least one player also plays the previous day
  const b2bDays = new Set<number>();
  for (const player of roster) {
    if (!player.schedule) continue;
    const days = player.schedule.game_days;
    for (let i = 1; i < days.length; i++) {
      if (days[i] === days[i - 1] + 1) {
        b2bDays.add(days[i]);
      }
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Week Schedule</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {Array.from({ length: game_span }, (_, dayIndex) => {
            const players = dayPlayers.get(dayIndex) ?? [];
            const isPast = dayIndex < current_day_index;
            const isCurrent = dayIndex === current_day_index;
            const isB2B = b2bDays.has(dayIndex);

            return (
              <div
                key={dayIndex}
                className={`flex min-w-[72px] flex-1 flex-col items-center gap-1 rounded-md border px-2 py-2 ${
                  isPast
                    ? "opacity-50"
                    : isCurrent
                      ? "border-primary/50 bg-primary/5"
                      : "border-border"
                }`}
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {getDayName(matchup_start, dayIndex)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(matchup_start, dayIndex)}
                </span>

                {players.length > 0 ? (
                  <>
                    <Badge
                      variant={players.length >= 4 ? "default" : "neutral"}
                      className="font-mono"
                    >
                      {players.length}
                    </Badge>
                    {isB2B && (
                      <span className="text-[10px] font-medium text-primary/70">
                        B2B
                      </span>
                    )}
                    <div className="mt-0.5 flex flex-col items-center gap-0.5">
                      {players.map((p) => (
                        <span
                          key={p.player_id}
                          className="max-w-[68px] truncate text-xs text-muted-foreground"
                        >
                          {getLastName(p.name)}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <span className="py-1 text-xs text-muted-foreground/50">
                    —
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
