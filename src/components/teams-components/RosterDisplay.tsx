"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import type { RosterPlayer } from "@/types/team";
import PlayerStatDisplay from "@/components/standings-components/PlayerStatDisplay";

export function RosterDisplay({ roster }: { roster: RosterPlayer[] }) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  // Create a copy to sort to avoid mutating props
  const sortedRoster = [...roster].sort((a, b) => b.avg_points - a.avg_points);

  let total_avg_points = 0;
  let total_players = 0;

  const handlePlayerClick = (player: RosterPlayer) => {
    setSelectedPlayerId(player.player_id);
  };

  return (
    <>
      <Card className="mt-5 w-full">
        <CardContent className="flex justify-center mb-[-20px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Rank</TableHead>
                <TableHead className="text-center">Name</TableHead>
                <TableHead className="w-[75px]">Team</TableHead>
                <TableHead className="w-[120px] text-center">
                  Avg Points
                </TableHead>
                <TableHead className="w-[120px] text-center">
                  Positions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRoster.map((player: RosterPlayer, index: number) => {
                total_avg_points += player.avg_points;
                total_players += 1;
                return (
                  <TableRow
                    key={`${player.name}-${index}`}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => handlePlayerClick(player)}
                  >
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{player.name}</TableCell>
                    <TableCell>{player.team}</TableCell>
                    <TableCell>{player.avg_points}</TableCell>
                    <TableCell>
                      {player.valid_positions
                        .slice(0, player.valid_positions.length - 3)
                        .join(", ")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
        <CardHeader className="text-left mb-[-25px]"></CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Roster Average Points</TableHead>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[75px]"></TableHead>
              <TableHead className="w-[120px] text-center">
                {total_players > 0
                  ? (total_avg_points / total_players).toFixed(2)
                  : "0.00"}
              </TableHead>
              <TableHead className="w-[120px] text-center"></TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </Card>

      {/* Player Stats Dialog */}
      <Dialog
        open={!!selectedPlayerId}
        onOpenChange={() => setSelectedPlayerId(null)}
      >
        <DialogContent className="max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Player Details</DialogTitle>
            <DialogDescription>
              Detailed stats and performance history.
            </DialogDescription>
          </DialogHeader>

          {selectedPlayerId && (
            <PlayerStatDisplay playerId={selectedPlayerId} />
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
