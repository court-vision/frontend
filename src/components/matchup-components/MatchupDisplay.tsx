"use client";

import { useState } from "react";
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
import type { MatchupData, MatchupTeam, MatchupPlayer } from "@/types/matchup";
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

function sortByLineupSlot(roster: MatchupPlayer[]): MatchupPlayer[] {
  return [...roster].sort((a, b) => {
    const orderA = LINEUP_SLOT_ORDER[a.lineup_slot] ?? 99;
    const orderB = LINEUP_SLOT_ORDER[b.lineup_slot] ?? 99;
    return orderA - orderB;
  });
}

function formatDate(dateString: string): string {
  // Parse date string as local date to avoid timezone conversion issues
  // Date strings like "2025-11-15" are parsed as UTC, which can cause day shifts
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

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
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Current
            </p>
            <p className="font-mono text-xl font-bold tabular-nums">
              {Math.round(team.current_score)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Projected
            </p>
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

interface MatchupDisplayProps {
  matchup: MatchupData | undefined;
  isLoading: boolean;
  error: Error | null;
  teamId: number | null;
  provider?: FantasyProvider;
}

export function MatchupDisplay({
  matchup,
  isLoading,
  error,
  teamId,
  provider = "espn",
}: MatchupDisplayProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(
    null
  );

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

  if (!matchup) {
    return (
      <Card variant="panel" className="p-8">
        <p className="text-sm text-muted-foreground text-center">
          No matchup data available. The season may not have started yet.
        </p>
      </Card>
    );
  }

  const handlePlayerClick = (player: MatchupPlayer) => {
    setSelectedPlayer({
      playerId: player.player_id,
      playerName: player.name,
      playerTeam: player.team,
    });
  };

  const yourTeamWinning = matchup.your_team.current_score > matchup.opponent_team.current_score;
  const scoreDiff = Math.abs(
    matchup.your_team.current_score - matchup.opponent_team.current_score
  ).toFixed(1);

  return (
    <>
      <div className="space-y-4">
        {/* Scoreboard Header */}
        <Card variant="panel" className="p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Week {matchup.matchup_period}
              </span>
              <span className="text-[10px] text-muted-foreground/50">
                {formatDate(matchup.matchup_period_start)} – {formatDate(matchup.matchup_period_end)}
              </span>
            </div>
            <Badge
              variant={yourTeamWinning ? "win" : "loss"}
            >
              {yourTeamWinning ? "Winning" : "Losing"} by {scoreDiff}
            </Badge>
          </div>

          {/* Score display */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                {matchup.your_team.team_name}
              </p>
              <p className="font-mono text-3xl font-bold tabular-nums mt-0.5">
                {Math.round(matchup.your_team.current_score)}
              </p>
            </div>
            <div className="text-center px-4">
              <span className="text-sm font-medium text-muted-foreground/40">VS</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground truncate max-w-[160px] ml-auto">
                {matchup.opponent_team.team_name}
              </p>
              <p className="font-mono text-3xl font-bold tabular-nums text-muted-foreground mt-0.5">
                {Math.round(matchup.opponent_team.current_score)}
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
                    matchup.your_team.current_score + matchup.opponent_team.current_score > 0
                      ? (matchup.your_team.current_score /
                          (matchup.your_team.current_score + matchup.opponent_team.current_score)) *
                        100
                      : 50
                  }%`,
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
              <span>Proj: {matchup.your_team.projected_score.toFixed(1)}</span>
              <span className="text-center">
                Winner: <span className="text-foreground font-medium">{matchup.projected_winner}</span>
                {" "}(+{matchup.projected_margin.toFixed(1)})
              </span>
              <span>Proj: {matchup.opponent_team.projected_score.toFixed(1)}</span>
            </div>
          </div>
        </Card>

        {/* Score progression chart */}
        <MatchupScoreChart
          teamId={teamId}
          matchupPeriod={matchup.matchup_period}
        />

        {/* Side-by-side team cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
        </div>
      </div>

      {/* Player Stats Dialog */}
      <Dialog
        open={!!selectedPlayer}
        onOpenChange={() => setSelectedPlayer(null)}
      >
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
