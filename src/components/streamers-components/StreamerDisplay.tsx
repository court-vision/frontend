"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableHeader,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { SkeletonTable } from "@/components/ui/skeleton-table";

import { WeekSchedule, WeekScheduleHeader } from "./WeekSchedule";
import PlayerStatDisplay from "@/components/rankings-components/PlayerStatDisplay";
import { useTeams } from "@/app/context/TeamsContext";
import { useStreamersQuery } from "@/hooks/useStreamers";
import type { StreamerPlayer } from "@/types/streamer";

const POSITIONS = ["PG", "SG", "SF", "PF", "C", "G", "F"] as const;
type Position = (typeof POSITIONS)[number];

const AVG_DAYS_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 14, label: "Last 14 days" },
  { value: 30, label: "Last 30 days" },
] as const;

interface SelectedPlayer {
  name: string;
  team: string;
}

export default function StreamerDisplay() {
  const { selectedTeam, teams } = useTeams();

  // Find the selected team's league info
  const selectedTeamData = useMemo(() => {
    return teams.find((t) => t.team_id === selectedTeam);
  }, [teams, selectedTeam]);

  const leagueInfo = selectedTeamData?.league_info || null;

  // Local state for filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPositions, setSelectedPositions] = useState<Set<Position>>(
    new Set()
  );
  const [b2bOnly, setB2bOnly] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [avgDays, setAvgDays] = useState(7);
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(null);

  // Fetch streamers
  const { data, isLoading, error } = useStreamersQuery(
    leagueInfo,
    selectedTeam,
    {
      faCount: 75,
      excludeInjured: true,
      b2bOnly: b2bOnly,
      day: selectedDay,
      avgDays: avgDays,
    }
  );

  // Filter streamers based on search and position filters
  const filteredStreamers = useMemo(() => {
    if (!data?.streamers) return [];

    return data.streamers.filter((player) => {
      // Search filter
      const matchesSearch = player.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      // Position filter (if any positions selected)
      const matchesPosition =
        selectedPositions.size === 0 ||
        player.valid_positions.some((pos) =>
          selectedPositions.has(pos as Position)
        );

      return matchesSearch && matchesPosition;
    });
  }, [data?.streamers, searchQuery, selectedPositions]);

  const togglePosition = (pos: Position) => {
    setSelectedPositions((prev) => {
      const next = new Set(prev);
      if (next.has(pos)) {
        next.delete(pos);
      } else {
        next.add(pos);
      }
      return next;
    });
  };

  const clearPositionFilters = () => {
    setSelectedPositions(new Set());
  };

  // Generate day options based on matchup game_span
  const dayOptions = useMemo(() => {
    if (!data) return [];
    // Assume game_span is typically 6 or 7, we can derive from current_day_index bounds
    // For now, generate 7 days as a reasonable default
    const maxDays = 7;
    return Array.from({ length: maxDays }, (_, i) => ({
      value: i,
      label: `Day ${i + 1}${i === data.current_day_index ? " (Today)" : ""}`,
    }));
  }, [data]);

  if (!selectedTeam) {
    return (
      <Card className="mt-5 w-full">
        <CardContent className="p-6 text-center text-muted-foreground">
          Please select a team from the dropdown to find streamers.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="mt-5 w-full">
        <CardContent className="p-6">
          <SkeletonTable rows={10} columns={7} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-5 w-full">
        <CardContent className="p-6 text-center text-destructive">
          Error loading streamers. Please try again.
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="mt-5 w-full">
        <CardContent className="p-6 text-center text-muted-foreground">
          No streamer data available.
        </CardContent>
      </Card>
    );
  }

  const totalDays = 7; // Standard matchup length

  return (
    <div className="flex flex-col w-full p-4 gap-4">
      {/* Filters Section */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Day Selector */}
        <Select
          value={selectedDay?.toString() ?? "current"}
          onValueChange={(val) =>
            setSelectedDay(val === "current" ? null : parseInt(val))
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Select day" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Current Day</SelectItem>
            {dayOptions.map((option) => (
              <SelectItem key={option.value} value={option.value.toString()}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* B2B Only Toggle */}
        <Button
          variant={b2bOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setB2bOnly(!b2bOnly)}
        >
          B2B Only
        </Button>

        {/* Avg Days Selector */}
        <Select
          value={avgDays.toString()}
          onValueChange={(val) => setAvgDays(parseInt(val))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Avg period" />
          </SelectTrigger>
          <SelectContent>
            {AVG_DAYS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value.toString()}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Position Filters */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Positions:</span>
          <div className="flex gap-1">
            {POSITIONS.map((pos) => (
              <Badge
                key={pos}
                variant={selectedPositions.has(pos) ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/80"
                onClick={() => togglePosition(pos)}
              >
                {pos}
              </Badge>
            ))}
          </div>
          {selectedPositions.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearPositionFilters}
              className="text-xs h-6 px-2"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Info Bar */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          Matchup {data.matchup_number} | Day {data.current_day_index + 1}
        </span>
        {data.teams_with_b2b.length > 0 && (
          <span>B2B Teams: {data.teams_with_b2b.join(", ")}</span>
        )}
        <span className="ml-auto">
          Showing {filteredStreamers.length} of {data.streamers.length} players
        </span>
      </div>

      {/* Streamers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead className="min-w-[250px] text-left">
                  Player
                </TableHead>
                <TableHead className="w-[60px] text-center">Team</TableHead>
                <TableHead className="w-[140px]">Positions</TableHead>
                <TableHead className="w-[80px] text-center">{avgDays}D Avg</TableHead>
                <TableHead className="w-[60px] text-center">Games</TableHead>
                <TableHead className="w-[180px] text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span>Schedule</span>
                    <WeekScheduleHeader
                      totalDays={totalDays}
                      currentDay={data.current_day_index}
                    />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStreamers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    No streamers found matching your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredStreamers.map(
                  (player: StreamerPlayer, index: number) => (
                    <TableRow
                      key={player.player_id}
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => setSelectedPlayer({ name: player.name, team: player.team })}
                    >
                      <TableCell className="text-center font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{player.name}</span>
                          {player.has_b2b && (
                            <Badge
                              variant="secondary"
                              className="w-fit text-[10px]"
                            >
                              B2B
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {player.team}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {player.valid_positions
                            .filter((pos) =>
                              ["PG", "SG", "SF", "PF", "C", "G", "F"].includes(
                                pos
                              )
                            )
                            .slice(0, 4)
                            .map((pos) => (
                              <Badge
                                key={pos}
                                variant="outline"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {pos}
                              </Badge>
                            ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {player.avg_points_last_n !== null
                          ? player.avg_points_last_n.toFixed(1)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {player.games_remaining}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center">
                          <WeekSchedule
                            gameDays={player.game_days}
                            totalDays={totalDays}
                            currentDay={data.current_day_index}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                )
              )}
            </TableBody>
          </Table>
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
              playerName={selectedPlayer.name}
              playerTeam={selectedPlayer.team}
            />
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button>Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
