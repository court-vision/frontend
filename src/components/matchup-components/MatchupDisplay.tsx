"use client";

import { useState } from "react";
import { cn, getTodayET } from "@/lib/utils";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState, StaleBadge } from "@/components/ui/query-error";
import PlayerStatDisplay from "@/components/rankings-components/PlayerStatDisplay";
import { MatchupScoreChart } from "@/components/matchup-components/MatchupScoreChart";
import { DayNavigationBar } from "@/components/matchup-components/DayNavigationBar";
import { DailyMatchupView } from "@/components/matchup-components/DailyMatchupView";
import { CategoryComparisonGrid } from "@/components/matchup-components/CategoryComparisonGrid";
import { Loader2, RefreshCw } from "lucide-react";
import { useGamesOnDateQuery } from "@/hooks/useGames";
import { useDailyMatchupQuery, useLiveMatchupQuery, useWeeklyMatchupQuery } from "@/hooks/useMatchup";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import { useSyncTeamLeagueMutation } from "@/hooks/useTeams";
import { formatRecord, winnerBadgeVariant } from "@/lib/category-format";
import { dayOutcomes, deriveHeadline, formatScalar, type TeamRecord } from "@/lib/matchup-headline";
import type {
  MatchupData,
  MatchupTeam,
  MatchupPlayer,
  LiveMatchupData,
  LiveMatchupTeam,
  LiveMatchupPlayer,
  PlayerLiveStats,
  ScoringFormat,
} from "@/types/matchup";
import type { CategoryDef } from "@/types/scoring";
import type { GameInfo } from "@/types/games";
import type { FantasyProvider } from "@/types/team";

interface SelectedPlayer {
  playerId: number;
  playerName: string;
  playerTeam: string;
}

// Order for lineup slots (starters first, then bench/IR)
const LINEUP_SLOT_ORDER: Record<string, number> = {
  PG: 1,
  SG: 2,
  SF: 3,
  PF: 4,
  C: 5,
  G: 6,
  F: 7,
  UT: 8,
  UTIL: 8,
  BE: 9,
  IR: 10,
};

function sortByLineupSlot<T extends MatchupPlayer>(roster: T[]): T[] {
  return [...roster].sort((a, b) => {
    const orderA = LINEUP_SLOT_ORDER[a.lineup_slot] ?? 99;
    const orderB = LINEUP_SLOT_ORDER[b.lineup_slot] ?? 99;
    return orderA - orderB;
  });
}

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getPlayerGame(playerTeam: string, games: GameInfo[]): GameInfo | null {
  return games.find((g) => g.home_team === playerTeam || g.away_team === playerTeam) ?? null;
}

// Parse ISO 8601 duration "PT05M23.00S" → "5:23" (mirrors SchedulePanel)
function formatGameClock(clock: string | null): string {
  if (!clock) return "";
  const match = clock.match(/PT(\d+)M([\d.]+)S/);
  if (match) {
    const mins = parseInt(match[1]);
    const secs = Math.floor(parseFloat(match[2]));
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  return "";
}

// Format "19:30" → "7:30P" (compact ET tip-off display)
function formatTipoff(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "P" : "A";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

interface GameStatusCellProps {
  player: LiveMatchupPlayer;
  game: GameInfo | null;
}

function GameStatusCell({ player, game }: GameStatusCellProps) {
  const live = player.live;

  if (!game) {
    return <span className="text-muted-foreground/30">—</span>;
  }

  const isHome = game.home_team === player.team;
  const opponent = isHome ? game.away_team : game.home_team;

  // No live record yet (pre-game: pipeline only fires once games start)
  // Fall back to game schedule data to show upcoming tip-off.
  if (!live) {
    if (game.status === "scheduled") {
      const timeStr = formatTipoff(game.start_time_et);
      return (
        <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
          vs {opponent}{timeStr ? ` · ${timeStr}` : ""}
        </span>
      );
    }
    return <span className="text-muted-foreground/30">—</span>;
  }

  const myScore = isHome ? game.home_score : game.away_score;
  const oppScore = isHome ? game.away_score : game.home_score;
  const scoreStr =
    myScore !== null && oppScore !== null ? `${myScore}-${oppScore}` : null;

  if (live.game_status === 1) {
    const timeStr = formatTipoff(game.start_time_et);
    return (
      <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
        vs {opponent}{timeStr ? ` · ${timeStr}` : ""}
      </span>
    );
  }

  if (live.game_status === 2) {
    const clockStr = formatGameClock(game.game_clock);
    return (
      <span className="flex items-center gap-1 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span className="text-[11px] font-mono text-emerald-400">
          {scoreStr ?? "—"} Q{live.period}
          {clockStr && (
            <span className="text-emerald-400/70"> {clockStr}</span>
          )}
        </span>
      </span>
    );
  }

  if (live.game_status === 3) {
    return (
      <span className="text-[11px] font-mono text-muted-foreground/60 whitespace-nowrap">
        F · {scoreStr ?? "—"}
      </span>
    );
  }

  return <span className="text-muted-foreground/30">—</span>;
}

// ── Simple roster table (used when live data is not yet available) ──────────

interface TeamRosterTableProps {
  team: MatchupTeam;
  onPlayerClick: (player: MatchupPlayer) => void;
}

function TeamRosterTable({ team, onPlayerClick }: TeamRosterTableProps) {
  const sortedRoster = sortByLineupSlot(team.roster);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px] pl-3">Slot</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="w-[50px]">Team</TableHead>
          <TableHead className="w-[70px] text-right pr-3">Pts</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRoster.map((player) => (
          <TableRow
            key={player.player_id}
            className="cursor-pointer hover:bg-muted/50 transition-colors border-l-2 border-l-transparent hover:border-l-primary"
            onClick={() => onPlayerClick(player)}
          >
            <TableCell className="pl-3">
              <Badge
                variant={
                  player.lineup_slot === "IR"
                    ? "outline"
                    : player.lineup_slot === "BE"
                      ? "secondary"
                      : "default"
                }
                className={player.lineup_slot === "IR" ? "text-muted-foreground" : ""}
              >
                {player.lineup_slot}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${player.injured ? "text-muted-foreground" : ""}`}>
                  {player.name}
                </span>
                {player.injured && player.injury_status && (
                  <Badge variant="destructive" className="text-[11px]">
                    {player.injury_status}
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {player.team}
            </TableCell>
            <TableCell className="text-right font-mono text-sm tabular-nums pr-3">
              {player.avg_points.toFixed(1)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Live stat grid (used when live matchup data is available) ────────────────

function StatCell({ value, hasStats }: { value: number | string; hasStats: boolean }) {
  if (!hasStats) {
    return <span className="text-muted-foreground/30">—</span>;
  }
  return <>{value}</>;
}

/** A live-table column: how to read one player's live line and total the team. */
interface LiveColumn {
  key: string;
  label: string;
  widthClass: string;
  cell: (live: PlayerLiveStats) => number | string;
  total: (lives: PlayerLiveStats[]) => string;
}

const LIVE_COUNTING: Record<string, keyof PlayerLiveStats> = {
  pts: "live_pts",
  reb: "live_reb",
  ast: "live_ast",
  stl: "live_stl",
  blk: "live_blk",
  tov: "live_tov",
  fg3m: "live_fg3m",
  fg3a: "live_fg3a",
  fgm: "live_fgm",
  fga: "live_fga",
  ftm: "live_ftm",
  fta: "live_fta",
};

const LIVE_RATES: Record<string, { makes: keyof PlayerLiveStats; attempts: keyof PlayerLiveStats }> = {
  fg_pct: { makes: "live_fgm", attempts: "live_fga" },
  ft_pct: { makes: "live_ftm", attempts: "live_fta" },
  fg3_pct: { makes: "live_fg3m", attempts: "live_fg3a" },
};

function liveNum(live: PlayerLiveStats, key: keyof PlayerLiveStats): number {
  const v = live[key];
  return typeof v === "number" ? v : 0;
}

/** The league's categories as live-table columns (makes-attempts for rates). */
function liveColumns(categories: CategoryDef[]): LiveColumn[] {
  return categories.flatMap((c): LiveColumn[] => {
    if (c.is_rate) {
      const r = LIVE_RATES[c.key];
      if (!r) return [];
      return [
        {
          key: c.key,
          label: c.label.replace("%", ""),
          widthClass: "w-[56px]",
          cell: (live) => `${liveNum(live, r.makes)}-${liveNum(live, r.attempts)}`,
          total: (lives) => {
            const makes = lives.reduce((s, l) => s + liveNum(l, r.makes), 0);
            const attempts = lives.reduce((s, l) => s + liveNum(l, r.attempts), 0);
            return attempts > 0 ? `${((makes / attempts) * 100).toFixed(1)}%` : "—";
          },
        },
      ];
    }
    const k = LIVE_COUNTING[c.key];
    if (!k) return [];
    return [
      {
        key: c.key,
        label: c.label,
        widthClass: "w-[36px]",
        cell: (live) => liveNum(live, k),
        total: (lives) => String(lives.reduce((s, l) => s + liveNum(l, k), 0)),
      },
    ];
  });
}

const POINTS_LIVE_COLUMNS: LiveColumn[] = (
  [
    ["pts", "PTS"],
    ["reb", "REB"],
    ["ast", "AST"],
    ["stl", "STL"],
    ["blk", "BLK"],
    ["tov", "TOV"],
  ] as const
).map(([key, label]) => ({
  key,
  label,
  widthClass: "w-[36px]",
  cell: (live: PlayerLiveStats) => liveNum(live, LIVE_COUNTING[key]),
  total: (lives: PlayerLiveStats[]) => String(lives.reduce((s, l) => s + liveNum(l, LIVE_COUNTING[key]), 0)),
}));

interface LiveTeamRosterTableProps {
  team: LiveMatchupTeam;
  games: GameInfo[];
  onPlayerClick: (player: LiveMatchupPlayer) => void;
  format: ScoringFormat;
  categories: CategoryDef[];
}

function LiveTeamRosterTable({ team, games, onPlayerClick, format, categories }: LiveTeamRosterTableProps) {
  const sorted = sortByLineupSlot(team.roster);
  const activePlayers = sorted.filter(
    (p) => p.lineup_slot !== "BE" && p.lineup_slot !== "IR"
  );
  const activeLives = activePlayers
    .map((p) => p.live)
    .filter((l): l is PlayerLiveStats => l !== null && l.game_status >= 2);
  const totalFpts = activeLives.reduce((sum, l) => sum + l.live_fpts, 0);
  const hasAnyLive = sorted.some((p) => p.live && p.live.game_status >= 2);
  const isCategories = format === "categories";
  const columns = isCategories ? liveColumns(categories) : POINTS_LIVE_COLUMNS;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px] pl-3">Slot</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="w-[110px] font-mono text-[11px] uppercase tracking-wider">Game</TableHead>
            <TableHead className="w-[36px] text-right font-mono text-[11px] uppercase tracking-wider">MIN</TableHead>
            {columns.map((col, i) => (
              <TableHead
                key={col.key}
                className={cn(
                  "text-right font-mono text-[11px] uppercase tracking-wider",
                  col.widthClass,
                  isCategories && i === columns.length - 1 && "pr-3"
                )}
              >
                {col.label}
              </TableHead>
            ))}
            {!isCategories && (
              <TableHead className="w-[46px] text-right pr-3 font-mono text-[11px] uppercase tracking-wider">FP</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((player) => {
            const live = player.live;
            const hasStats = live !== null && live.game_status >= 2;
            const isBench = player.lineup_slot === "BE" || player.lineup_slot === "IR";

            return (
              <TableRow
                key={player.player_id}
                className={cn(
                  "cursor-pointer hover:bg-muted/50 transition-colors border-l-2 border-l-transparent hover:border-l-primary",
                  isBench && "opacity-50"
                )}
                onClick={() => onPlayerClick(player)}
              >
                <TableCell className="pl-3">
                  <Badge
                    variant={
                      player.lineup_slot === "IR"
                        ? "outline"
                        : player.lineup_slot === "BE"
                          ? "secondary"
                          : "default"
                    }
                    className={player.lineup_slot === "IR" ? "text-muted-foreground" : ""}
                  >
                    {player.lineup_slot}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn(
                      "text-sm truncate",
                      player.injured && "text-muted-foreground"
                    )}>
                      {player.name}
                    </span>
                    {player.injured && player.injury_status && (
                      <Badge variant="destructive" className="text-[11px] shrink-0">
                        {player.injury_status}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <GameStatusCell player={player} game={getPlayerGame(player.team, games)} />
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  <StatCell value={live?.live_min ?? 0} hasStats={hasStats} />
                </TableCell>
                {columns.map((col, i) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      "text-right font-mono text-xs tabular-nums",
                      isCategories && i === columns.length - 1 && "pr-3"
                    )}
                  >
                    <StatCell value={live ? col.cell(live) : 0} hasStats={hasStats} />
                  </TableCell>
                ))}
                {!isCategories && (
                  <TableCell className={cn(
                    "text-right font-mono text-sm tabular-nums pr-3 font-semibold",
                    hasStats && !isBench && "text-foreground"
                  )}>
                    <StatCell value={live?.live_fpts ?? 0} hasStats={hasStats} />
                  </TableCell>
                )}
              </TableRow>
            );
          })}

          {/* Summary row — active players only */}
          {isCategories ? (
            <TableRow className="border-t border-border/50 bg-muted/20 hover:bg-muted/20">
              <TableCell colSpan={4} className="pl-3 py-2 text-[11px] text-muted-foreground uppercase tracking-wider">
                Active total {!hasAnyLive && <span className="normal-case">(no games yet)</span>}
              </TableCell>
              {columns.map((col, i) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    "text-right font-mono text-xs font-bold py-2 tabular-nums",
                    i === columns.length - 1 && "pr-3"
                  )}
                >
                  {hasAnyLive ? col.total(activeLives) : <span className="text-muted-foreground/30">—</span>}
                </TableCell>
              ))}
            </TableRow>
          ) : (
            <TableRow className="border-t border-border/50 bg-muted/20 hover:bg-muted/20">
              <TableCell colSpan={10} className="pl-3 py-2 text-[11px] text-muted-foreground uppercase tracking-wider">
                Active total {!hasAnyLive && <span className="normal-case">(no games yet)</span>}
              </TableCell>
              <TableCell className="text-right font-mono text-sm font-bold pr-3 py-2 tabular-nums">
                {hasAnyLive ? totalFpts : <span className="text-muted-foreground/30">—</span>}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Team card shells ─────────────────────────────────────────────────────────

/** "Current / Projected" header block; category leagues show the record instead. */
function TeamScoreHeader({
  current,
  projected,
  format,
  record,
}: {
  current: number;
  projected: number;
  format: ScoringFormat;
  record: TeamRecord | null;
}) {
  const isCategories = format === "categories";
  return (
    <div className="flex gap-6 mt-2">
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
          {isCategories ? "Cats won" : "Current"}
        </p>
        <p className="font-mono text-xl font-bold tabular-nums">
          {formatScalar(current, format, { round: true })}
        </p>
        {isCategories && record && (
          <p className="text-[11px] font-mono text-muted-foreground">
            {formatRecord(record.wins, record.losses, record.ties)}
          </p>
        )}
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Projected</p>
        <p className="font-mono text-lg text-muted-foreground tabular-nums">
          {isCategories ? `${Math.round(projected)} cats` : projected.toFixed(1)}
        </p>
      </div>
    </div>
  );
}

interface TeamCardProps {
  team: MatchupTeam;
  isYourTeam: boolean;
  onPlayerClick: (player: MatchupPlayer) => void;
  format: ScoringFormat;
  record: TeamRecord | null;
}

function TeamCard({ team, isYourTeam, onPlayerClick, format, record }: TeamCardProps) {
  return (
    <Card variant="panel" className="flex-1 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {isYourTeam && (
            <Badge variant="default" className="text-[11px]">You</Badge>
          )}
          <CardTitle className="text-sm font-semibold truncate">
            {team.team_name}
          </CardTitle>
        </div>
        <TeamScoreHeader
          current={team.current_score}
          projected={team.projected_score}
          format={format}
          record={record}
        />
      </CardHeader>
      <CardContent className="p-0">
        <TeamRosterTable team={team} onPlayerClick={onPlayerClick} />
      </CardContent>
    </Card>
  );
}

interface LiveTeamCardProps {
  team: LiveMatchupTeam;
  isYourTeam: boolean;
  games: GameInfo[];
  onPlayerClick: (player: LiveMatchupPlayer) => void;
  format: ScoringFormat;
  categories: CategoryDef[];
  record: TeamRecord | null;
}

function LiveTeamCard({ team, isYourTeam, games, onPlayerClick, format, categories, record }: LiveTeamCardProps) {
  return (
    <Card variant="panel" className="flex-1 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {isYourTeam && (
            <Badge variant="default" className="text-[11px]">You</Badge>
          )}
          <CardTitle className="text-sm font-semibold truncate">
            {team.team_name}
          </CardTitle>
        </div>
        <TeamScoreHeader
          current={team.current_score}
          projected={team.projected_score}
          format={format}
          record={record}
        />
      </CardHeader>
      <CardContent className="p-0">
        <LiveTeamRosterTable
          team={team}
          games={games}
          onPlayerClick={onPlayerClick}
          format={format}
          categories={categories}
        />
      </CardContent>
    </Card>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function MatchupSkeleton() {
  return (
    <div className="space-y-4">
      <Card variant="panel" className="p-5">
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="h-4 w-8" />
          <div className="space-y-1 flex flex-col items-end">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
        <Skeleton className="h-1.5 w-full rounded-full mt-4" />
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <Card variant="panel" key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
              <div className="flex gap-4 mt-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
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
    </div>
  );
}

// ── Scoreboard bars ──────────────────────────────────────────────────────────

/** Points: your share of the combined score. */
function PointsScoreBar({ you, opp }: { you: number; opp: number }) {
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
      <div
        className="bg-primary rounded-full transition-all duration-500"
        style={{ width: `${you + opp > 0 ? (you / (you + opp)) * 100 : 50}%` }}
      />
    </div>
  );
}

/** Categories: won / tied / lost segments out of the league's category count. */
function CategoryRecordBar({ record }: { record: TeamRecord }) {
  const total = record.wins + record.losses + record.ties;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden flex gap-px">
      <div className="bg-status-win transition-all duration-500" style={{ width: `${pct(record.wins)}%` }} />
      <div className="bg-muted-foreground/40 transition-all duration-500" style={{ width: `${pct(record.ties)}%` }} />
      <div className="bg-status-loss transition-all duration-500" style={{ width: `${pct(record.losses)}%` }} />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface MatchupDisplayProps {
  matchup: MatchupData | undefined;
  liveMatchup: LiveMatchupData | undefined;
  isLoading: boolean;
  error: Error | null;
  /** Refetch for the matchup query; wired to the error state's Retry. */
  onRetry?: () => void;
  teamId: number | null;
  provider?: FantasyProvider;
}

// getTodayET imported from @/lib/utils

export function MatchupDisplay({
  matchup,
  liveMatchup,
  isLoading,
  error,
  onRetry,
  teamId,
  provider = "espn",
}: MatchupDisplayProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { data: gamesData } = useGamesOnDateQuery(liveMatchup?.game_date ?? "");
  // Freshness of the live poll (deduped with the page's query by key): the live
  // section stays on screen with a paused badge when a poll fails.
  const live = useLiveMatchupQuery(teamId && teamId > 0 ? teamId : null);
  const { data: dailyMatchup, isLoading: dailyLoading } = useDailyMatchupQuery(
    teamId,
    selectedDate
  );
  const todayDate = getTodayET();

  // Category leagues also need the weekly days (per-day outcomes, chart fallback).
  const format: ScoringFormat = (liveMatchup ?? matchup)?.scoring_format ?? "points";
  const { data: weeklyData } = useWeeklyMatchupQuery(format === "categories" ? teamId : null);
  const { league } = useSelectedTeam(teamId);
  const syncLeague = useSyncTeamLeagueMutation();

  if (isLoading) {
    return <MatchupSkeleton />;
  }

  // Use liveMatchup for scores when available; fall back to matchup
  const display = liveMatchup ?? matchup;

  // Nothing to show and the matchup query failed. Expired ESPN/Yahoo credentials
  // get a "Reconnect" link, driven by `error_code` rather than message text.
  if (error && !display) {
    return (
      <Card variant="panel">
        <QueryErrorState error={error} onRetry={onRetry} />
      </Card>
    );
  }

  if (!display) {
    return (
      <Card variant="panel" className="p-8">
        <p className="text-sm text-muted-foreground text-center">
          No matchup data available. The season may not have started yet.
        </p>
      </Card>
    );
  }

  const handlePlayerClick = (player: MatchupPlayer | LiveMatchupPlayer) => {
    setSelectedPlayer({
      playerId: player.player_id,
      playerName: player.name,
      playerTeam: player.team,
    });
  };

  const h = deriveHeadline(display, matchup);
  const outcomes = h.isCategories ? dayOutcomes(weeklyData?.days) : undefined;
  const showSyncNotice = display.settings_synced === false && teamId !== null && teamId > 0;

  return (
    <>
      <div className="space-y-4">
        {/* League settings could not be synced — everything below is default points scoring */}
        {showSyncNotice && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-status-projected/30 bg-status-projected/10 px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              League settings haven&apos;t synced from {provider === "yahoo" ? "Yahoo" : "ESPN"} — showing the
              default points view. Category leagues need a sync to show categories.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[11px] gap-1 ml-auto"
              onClick={() => syncLeague.mutate(teamId as number)}
              disabled={syncLeague.isPending}
            >
              {syncLeague.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Sync
            </Button>
          </div>
        )}

        {/* Scoreboard Header */}
        <Card variant="panel" className="p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Week {display.matchup_period}
              </span>
              <span className="text-[11px] text-muted-foreground/50">
                {formatDate(display.matchup_period_start)} – {formatDate(display.matchup_period_end)}
              </span>
              {h.isCategories && league?.category_win_mode === "most_categories" && (
                <span className="hidden sm:inline text-[11px] text-muted-foreground/50">· most categories wins</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {liveMatchup && live.dataUpdatedAt > 0 && (
                <StaleBadge
                  dataUpdatedAt={live.dataUpdatedAt}
                  isFetching={live.isFetching}
                  error={live.error}
                />
              )}
              <Badge variant={winnerBadgeVariant(h.outcome)}>{h.statusLabel}</Badge>
            </div>
          </div>

          {/* Score display */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                {display.your_team.team_name}
              </p>
              <p className="font-mono text-3xl font-bold tabular-nums mt-0.5">
                {formatScalar(h.you, h.format, { round: true })}
              </p>
              {h.isCategories && h.yourRecord && (
                <p className="text-[11px] font-mono text-muted-foreground">
                  {formatRecord(h.yourRecord.wins, h.yourRecord.losses, h.yourRecord.ties)}
                </p>
              )}
            </div>
            <div className="text-center px-4">
              <span className="text-sm font-medium text-muted-foreground/40">VS</span>
              {h.isCategories && (
                <p className="text-[10px] font-mono text-muted-foreground/50 mt-1">
                  {h.categoryCount} cats
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground truncate max-w-[160px] ml-auto">
                {display.opponent_team.team_name}
              </p>
              <p className="font-mono text-3xl font-bold tabular-nums text-muted-foreground mt-0.5">
                {formatScalar(h.opp, h.format, { round: true })}
              </p>
              {h.isCategories && h.oppRecord && (
                <p className="text-[11px] font-mono text-muted-foreground">
                  {formatRecord(h.oppRecord.wins, h.oppRecord.losses, h.oppRecord.ties)}
                </p>
              )}
            </div>
          </div>

          {/* Score bar */}
          <div className="mt-4">
            {h.isCategories && h.yourRecord ? (
              <CategoryRecordBar record={h.yourRecord} />
            ) : (
              <PointsScoreBar you={h.you} opp={h.opp} />
            )}
            <div className="flex justify-between mt-2 text-[11px] text-muted-foreground">
              <span>{h.yourProjLabel}</span>
              <span className="text-center">
                Winner: <span className="text-foreground font-medium">{h.projWinner}</span>
                {" "}{h.projMarginLabel}
              </span>
              <span>{h.oppProjLabel}</span>
            </div>
          </div>
        </Card>

        {/* Category breakdown (category leagues only) */}
        {h.isCategories && h.comparison && (
          <CategoryComparisonGrid
            comparison={h.comparison}
            projected={h.projectedComparison}
            yourName={display.your_team.team_name}
            oppName={display.opponent_team.team_name}
            yourRaw={display.your_team.categories?.raw}
            oppRaw={display.opponent_team.categories?.raw}
            liveAdjusted={h.liveAdjusted}
            winMode={league?.category_win_mode}
          />
        )}

        {/* Day navigation bar */}
        <DayNavigationBar
          matchupPeriodStart={display.matchup_period_start}
          matchupPeriodEnd={display.matchup_period_end}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          todayDate={todayDate}
          dayOutcomes={outcomes}
        />

        {/* Score progression chart — always visible, mode driven by selectedDate */}
        <MatchupScoreChart
          teamId={teamId}
          matchupPeriod={display.matchup_period}
          liveScore={
            !selectedDate
              ? { your_score: display.your_team.current_score, opponent_score: display.opponent_team.current_score }
              : undefined
          }
          selectedDate={selectedDate}
          todayDate={todayDate}
          matchupPeriodEnd={display.matchup_period_end}
          yourProjectedScore={h.yourProj}
          oppProjectedScore={h.oppProj}
          format={h.format}
          categories={h.categories}
          weeklyDays={weeklyData?.days}
        />

        {/* Conditional: daily view or week overview */}
        {selectedDate && selectedDate !== todayDate ? (
          <DailyMatchupView
            dailyData={dailyMatchup}
            isLoading={dailyLoading}
          />
        ) : (
          <>
            {/* Side-by-side team cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {liveMatchup ? (
                <>
                  <LiveTeamCard
                    team={liveMatchup.your_team}
                    isYourTeam={true}
                    games={gamesData?.games ?? []}
                    onPlayerClick={handlePlayerClick}
                    format={h.format}
                    categories={h.categories}
                    record={h.yourRecord}
                  />
                  <LiveTeamCard
                    team={liveMatchup.opponent_team}
                    isYourTeam={false}
                    games={gamesData?.games ?? []}
                    onPlayerClick={handlePlayerClick}
                    format={h.format}
                    categories={h.categories}
                    record={h.oppRecord}
                  />
                </>
              ) : matchup ? (
                <>
                  <TeamCard
                    team={matchup.your_team}
                    isYourTeam={true}
                    onPlayerClick={handlePlayerClick}
                    format={h.format}
                    record={h.yourRecord}
                  />
                  <TeamCard
                    team={matchup.opponent_team}
                    isYourTeam={false}
                    onPlayerClick={handlePlayerClick}
                    format={h.format}
                    record={h.oppRecord}
                  />
                </>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Player Stats Dialog */}
      <Dialog open={!!selectedPlayer} onOpenChange={() => setSelectedPlayer(null)}>
        <DialogContent className="max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Player Details</DialogTitle>
            <DialogDescription>
              Detailed stats and performance history.
            </DialogDescription>
          </DialogHeader>

          {selectedPlayer && (
            <PlayerStatDisplay
              playerId={selectedPlayer.playerId}
              playerName={selectedPlayer.playerName}
              playerTeam={selectedPlayer.playerTeam}
              provider={provider}
            />
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
