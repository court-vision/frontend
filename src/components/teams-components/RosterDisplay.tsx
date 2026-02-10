"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import type { RosterPlayer, FantasyProvider } from "@/types/team";
import PlayerStatDisplay from "@/components/rankings-components/PlayerStatDisplay";

interface SelectedPlayer {
  playerId: number;
  playerName: string;
  playerTeam: string;
}

interface RosterDisplayProps {
  roster: RosterPlayer[];
  provider?: FantasyProvider;
}

export function RosterDisplay({ roster, provider = "espn" }: RosterDisplayProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(
    null
  );

  // Create a copy to sort to avoid mutating props
  const sortedRoster = [...roster].sort((a, b) => b.avg_points - a.avg_points);

  let total_avg_points = 0;
  let total_players = 0;

  const handlePlayerClick = (player: RosterPlayer) => {
    setSelectedPlayer({
      playerId: player.player_id,
      playerName: player.name,
      playerTeam: player.team,
    });
  };

  // Calculate totals before render
  sortedRoster.forEach((p) => {
    total_avg_points += p.avg_points;
    total_players += 1;
  });

  return (
    <>
      <Card variant="panel" className="w-full overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] pl-4">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="w-[60px]">Team</TableHead>
                <TableHead className="w-[100px] text-right">
                  Avg Pts
                </TableHead>
                <TableHead className="w-[120px] text-right pr-4">
                  Positions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRoster.map((player: RosterPlayer, index: number) => (
                <TableRow
                  key={`${player.name}-${index}`}
                  className="cursor-pointer hover:bg-muted/50 transition-colors border-l-2 border-l-transparent hover:border-l-primary"
                  onClick={() => handlePlayerClick(player)}
                >
                  <TableCell className="pl-4 font-mono text-xs text-muted-foreground tabular-nums">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {player.name}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {player.team}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {player.avg_points}
                  </TableCell>
                  <TableCell className="text-right pr-4 text-xs text-muted-foreground">
                    {player.valid_positions
                      .slice(0, player.valid_positions.length - 3)
                      .join(", ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Summary footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
            <span className="text-xs text-muted-foreground">
              Roster Average
            </span>
            <span className="font-mono text-sm font-medium tabular-nums">
              {total_players > 0
                ? (total_avg_points / total_players).toFixed(2)
                : "0.00"}
            </span>
          </div>
        </CardContent>
      </Card>

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
