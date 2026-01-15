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
import type { MatchupData, MatchupTeam, MatchupPlayer } from "@/types/matchup";

interface SelectedPlayer {
  name: string;
  team: string;
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
  const date = new Date(dateString);
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
          <TableHead className="w-[50px]">Slot</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="w-[50px]">Team</TableHead>
          <TableHead className="w-[70px] text-right">Pts</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRoster.map((player) => (
          <TableRow
            key={player.player_id}
            className="cursor-pointer hover:bg-muted"
            onClick={() => onPlayerClick(player)}
          >
            <TableCell>
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
                <span className={player.injured ? "text-muted-foreground" : ""}>
                  {player.name}
                </span>
                {player.injured && player.injury_status && (
                  <Badge variant="destructive" className="text-xs">
                    {player.injury_status}
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {player.team}
            </TableCell>
            <TableCell className="text-right font-medium">
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
    <Card className="flex-1">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {isYourTeam && (
              <span className="text-muted-foreground text-sm mr-2">Your Team</span>
            )}
            {team.team_name}
          </CardTitle>
        </div>
        <div className="flex gap-4 mt-2">
          <div>
            <p className="text-sm text-muted-foreground">Current</p>
            <p className="text-2xl font-bold">{team.current_score.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Projected</p>
            <p className="text-xl text-muted-foreground">
              {team.projected_score.toFixed(1)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <TeamRosterTable team={team} onPlayerClick={onPlayerClick} />
      </CardContent>
    </Card>
  );
}

function MatchupSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <div className="flex gap-4 mt-2">
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-10 w-20" />
            </div>
          </CardHeader>
          <CardContent>
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full mb-2" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <div className="flex gap-4 mt-2">
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-10 w-20" />
            </div>
          </CardHeader>
          <CardContent>
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full mb-2" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface MatchupDisplayProps {
  matchup: MatchupData | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function MatchupDisplay({
  matchup,
  isLoading,
  error,
}: MatchupDisplayProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(
    null
  );

  if (isLoading) {
    return <MatchupSkeleton />;
  }

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-destructive text-center">
          Error loading matchup: {error.message}
        </p>
      </Card>
    );
  }

  if (!matchup) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground text-center">
          No matchup data available. This could mean the season hasn&apos;t started
          yet or there&apos;s no active matchup period.
        </p>
      </Card>
    );
  }

  const handlePlayerClick = (player: MatchupPlayer) => {
    setSelectedPlayer({ name: player.name, team: player.team });
  };

  const yourTeamWinning = matchup.your_team.current_score > matchup.opponent_team.current_score;
  const scoreDiff = Math.abs(
    matchup.your_team.current_score - matchup.opponent_team.current_score
  ).toFixed(1);

  return (
    <>
      <div className="space-y-4">
        {/* Header with matchup period info */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h2 className="text-xl font-semibold">
              Matchup Period {matchup.matchup_period}
            </h2>
            <p className="text-sm text-muted-foreground">
              {formatDate(matchup.matchup_period_start)} -{" "}
              {formatDate(matchup.matchup_period_end)}
            </p>
          </div>
          <Badge
            variant={yourTeamWinning ? "default" : "secondary"}
            className="text-sm"
          >
            {yourTeamWinning ? "Winning" : "Losing"} by {scoreDiff}
          </Badge>
        </div>

        {/* Side-by-side team cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

        {/* Projection footer */}
        <Card className="p-4">
          <div className="flex justify-center items-center gap-2">
            <span className="text-muted-foreground">Projected Winner:</span>
            <span className="font-semibold">{matchup.projected_winner}</span>
            <Badge variant="outline">
              +{matchup.projected_margin.toFixed(1)}
            </Badge>
          </div>
        </Card>
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
              playerName={selectedPlayer.name}
              playerTeam={selectedPlayer.team}
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
