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
import type { FantasyProvider } from "@/types/team";

const POSITIONS = ["PG", "SG", "SF", "PF", "C", "G", "F"] as const;
type Position = (typeof POSITIONS)[number];

const AVG_DAYS_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 14, label: "Last 14 days" },
  { value: 30, label: "Last 30 days" },
] as const;

interface SelectedPlayer {
  playerId: number;
  playerName: string;
  playerTeam: string;
}

export default function StreamerDisplay() {
  const { selectedTeam, teams } = useTeams();

  // Find the selected team's league info
  const selectedTeamData = useMemo(() => {
    return teams.find((t) => t.team_id === selectedTeam);
  }, [teams, selectedTeam]);

  const leagueInfo = selectedTeamData?.league_info || null;
  const provider: FantasyProvider = leagueInfo?.provider || "espn";

  // Local state for filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPositions, setSelectedPositions] = useState<Set<Position>>(
    new Set()
  );
  const [b2bOnly, setB2bOnly] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [avgDays, setAvgDays] = useState(7);
  const [gameDayFilter, setGameDayFilter] = useState<number | null>(null);
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

      // Game day filter (only show players with a game on the selected day)
      const matchesGameDay =
        gameDayFilter === null || player.game_days.includes(gameDayFilter);

      return matchesSearch && matchesPosition && matchesGameDay;
    });
  }, [data?.streamers, searchQuery, selectedPositions, gameDayFilter]);

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
    return Array.from({ length: data.game_span }, (_, i) => ({
      value: i,
      label: `Day ${i + 1}${i === data.current_day_index ? " (Today)" : ""}`,
    }));
  }, [data]);

  if (!selectedTeam) {
    return (
      <Card variant="panel" className="w-full p-8">
        <p className="text-sm text-muted-foreground text-center">
          Select a team from the nav bar to find streamers.
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card variant="panel" className="w-full">
        <CardContent className="p-4">
          <SkeletonTable rows={10} columns={7} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="panel" className="w-full p-8">
        <p className="text-sm text-destructive text-center">
          Error loading streamers. Please try again.
        </p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card variant="panel" className="w-full p-8">
        <p className="text-sm text-muted-foreground text-center">
          No streamer data available.
        </p>
      </Card>
    );
  }

  const totalDays = data.game_span;

  return (
    <div className="flex flex-col w-full gap-3">
      {/* Filters Section */}
      <Card variant="panel" className="p-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-[260px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          {/* Day Selector */}
          <Select
            value={selectedDay?.toString() ?? "current"}
            onValueChange={(val) =>
              setSelectedDay(val === "current" ? null : parseInt(val))
            }
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
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

          {/* Game Day Filter */}
          <Select
            value={gameDayFilter?.toString() ?? "all"}
            onValueChange={(val) =>
              setGameDayFilter(val === "all" ? null : parseInt(val))
            }
          >
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Playing on..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Game Days</SelectItem>
              {dayOptions.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  Playing {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* B2B Only Toggle */}
          <Button
            variant={b2bOnly ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setB2bOnly(!b2bOnly)}
          >
            B2B Only
          </Button>

          {/* Avg Days Selector */}
          <Select
            value={avgDays.toString()}
            onValueChange={(val) => setAvgDays(parseInt(val))}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
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
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1">
              {POSITIONS.map((pos) => (
                <Badge
                  key={pos}
                  variant={selectedPositions.has(pos) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80 text-[10px]"
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
                className="text-[10px] h-5 px-1.5"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Info Bar */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground px-1">
        <span>
          Matchup {data.matchup_number} &middot; Day {data.current_day_index + 1}
        </span>
        {data.teams_with_b2b.length > 0 && (
          <span className="hidden sm:inline">B2B: {data.teams_with_b2b.join(", ")}</span>
        )}
        <span className="ml-auto">
          {filteredStreamers.length} of {data.streamers.length} players
        </span>
      </div>

      {/* Streamers Table */}
      <Card variant="panel" className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] text-center pl-3">#</TableHead>
                <TableHead className="min-w-[200px]">Player</TableHead>
                <TableHead className="w-[50px] text-center">Team</TableHead>
                <TableHead className="w-[120px]">Pos</TableHead>
                <TableHead className="w-[70px] text-right">{avgDays}D Avg</TableHead>
                <TableHead className="w-[50px] text-center">GP</TableHead>
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
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    No streamers found matching your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredStreamers.map(
                  (player: StreamerPlayer, index: number) => (
                    <TableRow
                      key={player.player_id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors border-l-2 border-l-transparent hover:border-l-primary"
                      onClick={() => setSelectedPlayer({
                        playerId: player.player_id,
                        playerName: player.name,
                        playerTeam: player.team,
                      })}
                    >
                      <TableCell className="text-center pl-3 font-mono text-xs text-muted-foreground tabular-nums">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{player.name}</span>
                          {player.has_b2b && (
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                            >
                              B2B
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {player.team}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {player.valid_positions
                            .filter((pos) =>
                              ["PG", "SG", "SF", "PF", "C", "G", "F"].includes(pos)
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
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {player.avg_points_last_n !== null
                          ? player.avg_points_last_n.toFixed(1)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm tabular-nums">
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
              playerId={selectedPlayer.playerId}
              playerName={selectedPlayer.playerName}
              playerTeam={selectedPlayer.playerTeam}
              provider={provider}
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
