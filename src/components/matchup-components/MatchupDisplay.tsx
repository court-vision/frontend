"use client";

import { useState } from "react";
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
import PlayerStatDisplay from "@/components/rankings-components/PlayerStatDisplay";
import { MatchupScoreChart } from "@/components/matchup-components/MatchupScoreChart";
import Link from "next/link";
import { useGamesOnDateQuery } from "@/hooks/useGames";
import type {
  MatchupData,
  MatchupTeam,
  MatchupPlayer,
  LiveMatchupData,
  LiveMatchupTeam,
  LiveMatchupPlayer,
} from "@/types/matchup";
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

  if (!live || !game) {
    return <span className="text-muted-foreground/30">—</span>;
  }

  const isHome = game.home_team === player.team;
  const myScore = isHome ? game.home_score : game.away_score;
  const oppScore = isHome ? game.away_score : game.home_score;
  const opponent = isHome ? game.away_team : game.home_team;
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
                  <Badge variant="destructive" className="text-[10px]">
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

function StatCell({ value, hasStats }: { value: number; hasStats: boolean }) {
  if (!hasStats) {
    return <span className="text-muted-foreground/30">—</span>;
  }
  return <>{value}</>;
}

interface LiveTeamRosterTableProps {
  team: LiveMatchupTeam;
  games: GameInfo[];
  onPlayerClick: (player: LiveMatchupPlayer) => void;
}

function LiveTeamRosterTable({ team, games, onPlayerClick }: LiveTeamRosterTableProps) {
  const sorted = sortByLineupSlot(team.roster);
  const activePlayers = sorted.filter(
    (p) => p.lineup_slot !== "BE" && p.lineup_slot !== "IR"
  );
  const totalFpts = activePlayers.reduce(
    (sum, p) => sum + (p.live && p.live.game_status >= 2 ? p.live.live_fpts : 0),
    0
  );
  const hasAnyLive = sorted.some((p) => p.live && p.live.game_status >= 2);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px] pl-3">Slot</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="w-[110px] font-mono text-[10px] uppercase tracking-wider">Game</TableHead>
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
                      <Badge variant="destructive" className="text-[10px] shrink-0">
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
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  <StatCell value={live?.live_pts ?? 0} hasStats={hasStats} />
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  <StatCell value={live?.live_reb ?? 0} hasStats={hasStats} />
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  <StatCell value={live?.live_ast ?? 0} hasStats={hasStats} />
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  <StatCell value={live?.live_stl ?? 0} hasStats={hasStats} />
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  <StatCell value={live?.live_blk ?? 0} hasStats={hasStats} />
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  <StatCell value={live?.live_tov ?? 0} hasStats={hasStats} />
                </TableCell>
                <TableCell className={cn(
                  "text-right font-mono text-sm tabular-nums pr-3 font-semibold",
                  hasStats && !isBench && "text-foreground"
                )}>
                  <StatCell value={live?.live_fpts ?? 0} hasStats={hasStats} />
                </TableCell>
              </TableRow>
            );
          })}

          {/* Summary row — active players only */}
          <TableRow className="border-t border-border/50 bg-muted/20 hover:bg-muted/20">
            <TableCell colSpan={10} className="pl-3 py-2 text-[10px] text-muted-foreground uppercase tracking-wider">
              Active total {!hasAnyLive && <span className="normal-case">(no games yet)</span>}
            </TableCell>
            <TableCell className="text-right font-mono text-sm font-bold pr-3 py-2 tabular-nums">
              {hasAnyLive ? totalFpts : <span className="text-muted-foreground/30">—</span>}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

// ── Team card shells ─────────────────────────────────────────────────────────

interface TeamCardProps {
  team: MatchupTeam;
  isYourTeam: boolean;
  onPlayerClick: (player: MatchupPlayer) => void;
}

function TeamCard({ team, isYourTeam, onPlayerClick }: TeamCardProps) {
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
        <div className="flex gap-6 mt-2">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Current</p>
            <p className="font-mono text-xl font-bold tabular-nums">
              {Math.round(team.current_score)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Projected</p>
            <p className="font-mono text-lg text-muted-foreground tabular-nums">
              {team.projected_score.toFixed(1)}
            </p>
          </div>
        </div>
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
}

function LiveTeamCard({ team, isYourTeam, games, onPlayerClick }: LiveTeamCardProps) {
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
        <div className="flex gap-6 mt-2">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Current</p>
            <p className="font-mono text-xl font-bold tabular-nums">
              {Math.round(team.current_score)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Projected</p>
            <p className="font-mono text-lg text-muted-foreground tabular-nums">
              {team.projected_score.toFixed(1)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <LiveTeamRosterTable team={team} games={games} onPlayerClick={onPlayerClick} />
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

// ── Main component ───────────────────────────────────────────────────────────

interface MatchupDisplayProps {
  matchup: MatchupData | undefined;
  liveMatchup: LiveMatchupData | undefined;
  isLoading: boolean;
  error: Error | null;
  teamId: number | null;
  provider?: FantasyProvider;
}

export function MatchupDisplay({
  matchup,
  liveMatchup,
  isLoading,
  error,
  teamId,
  provider = "espn",
}: MatchupDisplayProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(null);
  const { data: gamesData } = useGamesOnDateQuery(liveMatchup?.game_date ?? "");

  if (isLoading) {
    return <MatchupSkeleton />;
  }

  if (error) {
    const isYahooAuthError =
      error.message.toLowerCase().includes("yahoo") &&
      (error.message.toLowerCase().includes("authentication") ||
        error.message.toLowerCase().includes("expired") ||
        error.message.toLowerCase().includes("reconnect"));

    return (
      <Card variant="panel" className="p-8">
        <div className="text-center space-y-3">
          <p className="text-sm text-destructive">Error loading matchup: {error.message}</p>
          {isYahooAuthError && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Your Yahoo connection has expired. Please reconnect your Yahoo account.
              </p>
              <Link href="/manage-teams">
                <Button variant="outline" size="sm">Manage Teams</Button>
              </Link>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Use liveMatchup for scores when available; fall back to matchup
  const display = liveMatchup ?? matchup;

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

  const yourScore = display.your_team.current_score;
  const oppScore = display.opponent_team.current_score;
  const yourTeamWinning = yourScore > oppScore;
  const scoreDiff = Math.abs(yourScore - oppScore).toFixed(1);

  // Projected fields always come from the regular matchup (more stable)
  const projectedWinner = matchup?.projected_winner ?? display.projected_winner;
  const projectedMargin = matchup?.projected_margin ?? display.projected_margin;
  const yourProjected = matchup?.your_team.projected_score ?? display.your_team.projected_score;
  const oppProjected = matchup?.opponent_team.projected_score ?? display.opponent_team.projected_score;

  return (
    <>
      <div className="space-y-4">
        {/* Scoreboard Header */}
        <Card variant="panel" className="p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Week {display.matchup_period}
              </span>
              <span className="text-[10px] text-muted-foreground/50">
                {formatDate(display.matchup_period_start)} – {formatDate(display.matchup_period_end)}
              </span>
            </div>
            <Badge variant={yourTeamWinning ? "win" : "loss"}>
              {yourTeamWinning ? "Winning" : "Losing"} by {scoreDiff}
            </Badge>
          </div>

          {/* Score display */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                {display.your_team.team_name}
              </p>
              <p className="font-mono text-3xl font-bold tabular-nums mt-0.5">
                {Math.round(yourScore)}
              </p>
            </div>
            <div className="text-center px-4">
              <span className="text-sm font-medium text-muted-foreground/40">VS</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground truncate max-w-[160px] ml-auto">
                {display.opponent_team.team_name}
              </p>
              <p className="font-mono text-3xl font-bold tabular-nums text-muted-foreground mt-0.5">
                {Math.round(oppScore)}
              </p>
            </div>
          </div>

          {/* Score bar */}
          <div className="mt-4">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
              <div
                className="bg-primary rounded-full transition-all duration-500"
                style={{
                  width: `${
                    yourScore + oppScore > 0
                      ? (yourScore / (yourScore + oppScore)) * 100
                      : 50
                  }%`,
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
              <span>Proj: {yourProjected.toFixed(1)}</span>
              <span className="text-center">
                Winner: <span className="text-foreground font-medium">{projectedWinner}</span>
                {" "}(+{projectedMargin.toFixed(1)})
              </span>
              <span>Proj: {oppProjected.toFixed(1)}</span>
            </div>
          </div>
        </Card>

        {/* Score progression chart */}
        <MatchupScoreChart
          teamId={teamId}
          matchupPeriod={display.matchup_period}
          liveScore={{
            your_score: display.your_team.current_score,
            opponent_score: display.opponent_team.current_score,
          }}
        />

        {/* Side-by-side team cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {liveMatchup ? (
            <>
              <LiveTeamCard
                team={liveMatchup.your_team}
                isYourTeam={true}
                games={gamesData?.games ?? []}
                onPlayerClick={handlePlayerClick}
              />
              <LiveTeamCard
                team={liveMatchup.opponent_team}
                isYourTeam={false}
                games={gamesData?.games ?? []}
                onPlayerClick={handlePlayerClick}
              />
            </>
          ) : matchup ? (
            <>
              <TeamCard
                team={matchup.your_team}
                isYourTeam={true}
                onPlayerClick={handlePlayerClick}
              />
              <TeamCard
                team={matchup.opponent_team}
                isYourTeam={false}
                onPlayerClick={handlePlayerClick}
              />
            </>
          ) : null}
        </div>
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
