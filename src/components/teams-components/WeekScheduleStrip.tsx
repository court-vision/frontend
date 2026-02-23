"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  EnrichedRosterPlayer,
  ScheduleOverview,
} from "@/types/team-insights";

interface WeekScheduleStripProps {
  roster: EnrichedRosterPlayer[];
  scheduleOverview: ScheduleOverview;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
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

function getChipClass(positions: string[], injured: boolean): string {
  if (injured) return "bg-red-500/10 text-red-500 border-red-500/20";
  const pos = positions[0]?.toUpperCase() ?? "";
  if (["PG", "G"].includes(pos)) return "bg-blue-500/10 text-blue-500 border-blue-500/20";
  if (pos === "SG") return "bg-cyan-500/10 text-cyan-500 border-cyan-500/20";
  if (["SF", "F"].includes(pos)) return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  if (pos === "PF") return "bg-orange-500/10 text-orange-500 border-orange-500/20";
  if (pos === "C") return "bg-violet-500/10 text-violet-500 border-violet-500/20";
  return "bg-muted/50 text-muted-foreground border-border";
}

export function WeekScheduleStrip({
  roster,
  scheduleOverview,
}: WeekScheduleStripProps) {
  const { matchup_start, matchup_end, current_day_index, game_span, matchup_number } = scheduleOverview;

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

  // Max players in any single day (for density bar scaling)
  let maxPlayers = 0;
  for (const players of dayPlayers.values()) {
    if (players.length > maxPlayers) maxPlayers = players.length;
  }

  // B2B days
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

  const formatShort = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const dateRange = `${formatShort(matchup_start)} – ${formatShort(matchup_end)}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Week Schedule</CardTitle>
          <span className="font-mono text-xs text-muted-foreground">
            Matchup {matchup_number} · {dateRange}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {Array.from({ length: game_span }, (_, dayIndex) => {
            const players = dayPlayers.get(dayIndex) ?? [];
            const isPast = dayIndex < current_day_index;
            const isCurrent = dayIndex === current_day_index;
            const isB2B = b2bDays.has(dayIndex);
            const densityPct = maxPlayers > 0 ? (players.length / maxPlayers) * 100 : 0;

            return (
              <div
                key={dayIndex}
                className={`flex min-w-[72px] flex-1 flex-col gap-2 rounded-lg border px-2 py-2 transition-opacity ${
                  isPast
                    ? "opacity-40"
                    : isCurrent
                      ? "border-primary/50 bg-primary/5"
                      : "border-border"
                }`}
              >
                {/* Density bar */}
                <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted/40">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isCurrent ? "bg-primary/70" : "bg-muted-foreground/40"
                    }`}
                    style={{ width: `${densityPct}%` }}
                  />
                </div>

                {/* Day header */}
                <div className="flex flex-col items-center">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wide ${
                      isCurrent ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {getDayName(matchup_start, dayIndex)}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/60">
                    {formatDate(matchup_start, dayIndex)}
                  </span>
                </div>

                {/* Count + B2B */}
                <div className="flex items-center justify-center gap-1">
                  <span
                    className={`font-mono text-sm font-bold tabular-nums ${
                      players.length === 0
                        ? "text-muted-foreground/30"
                        : players.length >= 4
                          ? isCurrent
                            ? "text-primary"
                            : "text-foreground"
                          : "text-muted-foreground"
                    }`}
                  >
                    {players.length}
                  </span>
                  {isB2B && (
                    <span className="rounded border border-amber-500/20 bg-amber-500/10 px-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-amber-500">
                      B2B
                    </span>
                  )}
                </div>

                {/* Player initials chips */}
                <div className="flex flex-wrap justify-center gap-0.5">
                  {players.length > 0 ? (
                    players.map((p) => (
                      <div
                        key={p.player_id}
                        title={p.name}
                        className={`flex h-5 w-[26px] items-center justify-center rounded border font-mono text-[9px] font-bold tracking-wide ${
                          getChipClass(p.valid_positions, p.injured)
                        }`}
                      >
                        {getInitials(p.name)}
                      </div>
                    ))
                  ) : (
                    <span className="py-0.5 font-mono text-[10px] text-muted-foreground/30">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
