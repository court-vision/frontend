"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DailyMatchupData,
  DailyMatchupTeam,
  DailyMatchupPlayerStats,
  DailyMatchupFuturePlayer,
} from "@/types/matchup";

// Format "19:30" → "7:30P"
function formatTipoff(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "P" : "A";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

function StatCell({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-muted-foreground/30">—</span>;
  }
  return <>{value}</>;
}

// ── Past Day Roster Table ──────────────────────────────────────────────────

interface PastRosterTableProps {
  roster: DailyMatchupPlayerStats[];
}

function PastRosterTable({ roster }: PastRosterTableProps) {
  const totalFpts = roster.reduce((sum, p) => sum + (p.fpts ?? 0), 0);
  const hasAnyStats = roster.some((p) => p.fpts !== null);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-3">Player</TableHead>
            <TableHead className="w-[40px] font-mono text-[10px] uppercase tracking-wider">Team</TableHead>
            <TableHead className="w-[36px] text-right font-mono text-[10px] uppercase tracking-wider">MIN</TableHead>
            <TableHead className="w-[36px] text-right font-mono text-[10px] uppercase tracking-wider">PTS</TableHead>
            <TableHead className="w-[36px] text-right font-mono text-[10px] uppercase tracking-wider">REB</TableHead>
            <TableHead className="w-[36px] text-right font-mono text-[10px] uppercase tracking-wider">AST</TableHead>
            <TableHead className="w-[36px] text-right font-mono text-[10px] uppercase tracking-wider">STL</TableHead>
            <TableHead className="w-[36px] text-right font-mono text-[10px] uppercase tracking-wider">BLK</TableHead>
            <TableHead className="w-[36px] text-right font-mono text-[10px] uppercase tracking-wider">TOV</TableHead>
            <TableHead className="w-[46px] text-right pr-3 font-mono text-[10px] uppercase tracking-wider">FP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roster.map((player) => {
            const hasStats = player.fpts !== null;
            const noGame = !player.had_game;

            return (
              <TableRow
                key={player.player_id}
                className={cn(
                  "border-l-2 border-l-transparent",
                  noGame && "opacity-40"
                )}
              >
                <TableCell className="pl-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm truncate">{player.name}</span>
                    <span className="text-[10px] text-muted-foreground">{player.position}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{player.team}</TableCell>
                {noGame ? (
                  <TableCell colSpan={8} className="text-center text-xs text-muted-foreground/50">
                    No game
                  </TableCell>
                ) : !hasStats ? (
                  <>
                    <TableCell colSpan={7} className="text-center text-xs text-muted-foreground/50">
                      DNP
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums pr-3 text-muted-foreground/50">
                      —
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      <StatCell value={player.min} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      <StatCell value={player.pts} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      <StatCell value={player.reb} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      <StatCell value={player.ast} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      <StatCell value={player.stl} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      <StatCell value={player.blk} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      <StatCell value={player.tov} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums pr-3 font-semibold">
                      <StatCell value={player.fpts} />
                    </TableCell>
                  </>
                )}
              </TableRow>
            );
          })}

          {/* Summary row */}
          <TableRow className="border-t border-border/50 bg-muted/20 hover:bg-muted/20">
            <TableCell colSpan={9} className="pl-3 py-2 text-[10px] text-muted-foreground uppercase tracking-wider">
              Day total {!hasAnyStats && <span className="normal-case">(no stats)</span>}
            </TableCell>
            <TableCell className="text-right font-mono text-sm font-bold pr-3 py-2 tabular-nums">
              {hasAnyStats ? totalFpts : <span className="text-muted-foreground/30">—</span>}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

// ── Future Day Roster Table ────────────────────────────────────────────────

interface FutureRosterTableProps {
  roster: DailyMatchupFuturePlayer[];
}

function FutureRosterTable({ roster }: FutureRosterTableProps) {
  const playingCount = roster.filter((p) => p.has_game).length;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-3">Player</TableHead>
          <TableHead className="w-[40px] font-mono text-[10px] uppercase tracking-wider">Team</TableHead>
          <TableHead className="pr-3 font-mono text-[10px] uppercase tracking-wider">Game</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roster.map((player) => (
          <TableRow
            key={player.player_id}
            className={cn(
              "border-l-2 border-l-transparent",
              !player.has_game && "opacity-40"
            )}
          >
            <TableCell className="pl-3">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={cn("text-sm truncate", player.injured && "text-muted-foreground")}>
                  {player.name}
                </span>
                <span className="text-[10px] text-muted-foreground">{player.position}</span>
                {player.injured && player.injury_status && (
                  <Badge variant="destructive" className="text-[10px] shrink-0">
                    {player.injury_status}
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{player.team}</TableCell>
            <TableCell className="pr-3">
              {player.has_game ? (
                <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                  {player.opponent}
                  {player.game_time_et && ` · ${formatTipoff(player.game_time_et)}`}
                </span>
              ) : (
                <span className="text-muted-foreground/30">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}

        {/* Summary row */}
        <TableRow className="border-t border-border/50 bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={3} className="pl-3 py-2 text-[10px] text-muted-foreground uppercase tracking-wider">
            {playingCount} player{playingCount !== 1 ? "s" : ""} with games
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

// ── Daily Team Card ────────────────────────────────────────────────────────

interface DailyTeamCardProps {
  team: DailyMatchupTeam;
  dayType: "past" | "today" | "future";
  isYourTeam: boolean;
}

function DailyTeamCard({ team, dayType, isYourTeam }: DailyTeamCardProps) {
  const isPast = dayType === "past" || dayType === "today";

  return (
    <Card variant="panel" className="flex-1 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {isYourTeam && (
            <Badge variant="default" className="text-[10px]">You</Badge>
          )}
          <CardTitle className="text-sm font-semibold truncate">
            {team.team_name}
          </CardTitle>
        </div>
        {isPast && (
          <div className="mt-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Day Total</p>
            <p className="font-mono text-xl font-bold tabular-nums">
              {team.total_fpts !== null ? Math.round(team.total_fpts) : "—"}
            </p>
          </div>
        )}
        {!isPast && (
          <div className="mt-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Players w/ Games</p>
            <p className="font-mono text-xl font-bold tabular-nums">
              {(team.roster as DailyMatchupFuturePlayer[]).filter((p) => p.has_game).length}
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isPast ? (
          <PastRosterTable roster={team.roster as DailyMatchupPlayerStats[]} />
        ) : (
          <FutureRosterTable roster={team.roster as DailyMatchupFuturePlayer[]} />
        )}
      </CardContent>
    </Card>
  );
}

// ── Loading Skeleton ───────────────────────────────────────────────────────

function DailySkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {[0, 1].map((i) => (
        <Card variant="panel" key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-32" />
            <div className="mt-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-12 mt-1" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {[...Array(8)].map((_, j) => (
              <Skeleton key={j} className="h-9 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main DailyMatchupView ──────────────────────────────────────────────────

interface DailyMatchupViewProps {
  dailyData: DailyMatchupData | undefined;
  isLoading: boolean;
}

export function DailyMatchupView({ dailyData, isLoading }: DailyMatchupViewProps) {
  if (isLoading) {
    return <DailySkeleton />;
  }

  if (!dailyData) {
    return (
      <Card variant="panel" className="p-8">
        <p className="text-sm text-muted-foreground text-center">
          No data available for this date.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <DailyTeamCard
        team={dailyData.your_team}
        dayType={dailyData.day_type}
        isYourTeam={true}
      />
      <DailyTeamCard
        team={dailyData.opponent_team}
        dayType={dailyData.day_type}
        isYourTeam={false}
      />
    </div>
  );
}
