"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RosterPlayer } from "@/types/team";

export function RosterDisplay({ roster }: { roster: RosterPlayer[] }) {
  // Create a copy to sort to avoid mutating props
  const sortedRoster = [...roster].sort((a, b) => b.avg_points - a.avg_points);
  
  let total_avg_points = 0;
  let total_players = 0;

  return (
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
              <TableHead className="w-[120px] text-center">Positions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRoster.map((player: RosterPlayer, index: number) => {
              total_avg_points += player.avg_points;
              total_players += 1;
              return (
                <TableRow key={`${player.name}-${index}`}>
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
  );
}

