"use client";

import { useState, useMemo, Fragment } from "react";
import { Search, SlidersHorizontal } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { HintPopover } from "@/components/ui/hint";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { QueryErrorState } from "@/components/ui/query-error";

import { WeekSchedule, WeekScheduleHeader } from "./WeekSchedule";
import { BreakoutContextSection } from "./BreakoutContextSection";
import { OppBadge, PositionBadges, PriorSeasonBadge } from "./StreamerBadges";
import { StreamerCard } from "./StreamerCard";
import {
  StreamerFilterControls,
  countActiveStreamerFilters,
  DEFAULT_AVG_DAYS,
  type Position,
} from "./StreamerFilterControls";
import { StreamerFilterSheet } from "./StreamerFilterSheet";
import PlayerStatDisplay from "@/components/rankings-components/PlayerStatDisplay";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import { useStreamersQuery } from "@/hooks/useStreamers";
import { useBreakoutStreamersQuery } from "@/hooks/useBreakoutStreamers";
import { CAT_VALUE_TITLE } from "@/lib/category-format";
import { formatPositions } from "@/lib/positions";
import { PlayerHeadshot } from "@/components/terminal/shared";
import { userMessage } from "@/lib/api-error";
import type { StreamerPlayer, StreamerMode } from "@/types/streamer";
import type { BreakoutCandidateResp } from "@/types/breakout";

interface SelectedPlayer {
  playerId: number;
  playerName: string;
  playerTeam: string;
  position: string | null;
  breakoutContext?: BreakoutCandidateResp;
}

function ModeTabs({
  mode,
  onChange,
  className,
  listClassName,
  triggerClassName,
}: {
  mode: StreamerMode;
  onChange: (mode: StreamerMode) => void;
  className?: string;
  listClassName?: string;
  triggerClassName?: string;
}) {
  return (
    <Tabs
      value={mode}
      onValueChange={(v) => onChange(v as StreamerMode)}
      className={className}
    >
      <TabsList className={listClassName}>
        <TabsTrigger value="daily" className={triggerClassName}>
          Daily Pickup
        </TabsTrigger>
        <TabsTrigger value="week" className={triggerClassName}>
          Rest of Week
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export default function StreamerDisplay() {
  const {
    teamId: selectedTeam,
    team: selectedTeamData,
    provider,
    teamsError,
    refetchTeams,
  } = useSelectedTeam();
  const leagueInfo = selectedTeamData?.league_info || null;
  // Safe to branch on: Base withholds this page until Clerk has loaded, so the
  // hook has its real value before we mount (no desktop flash).
  const isMobile = useIsMobile();

  // Local state for filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPositions, setSelectedPositions] = useState<Set<Position>>(
    new Set()
  );
  const [mode, setMode] = useState<StreamerMode>("daily");
  const [b2bOnly, setB2bOnly] = useState(false);
  const [breakoutOnly, setBreakoutOnly] = useState(false);
  const [targetDay, setTargetDay] = useState<number | null>(null);
  const [avgDays, setAvgDays] = useState(DEFAULT_AVG_DAYS);
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Fetch streamers
  const { data, isLoading, error, refetch, isFetching } = useStreamersQuery(
    leagueInfo,
    selectedTeam,
    {
      faCount: 300,
      excludeInjured: true,
      b2bOnly: b2bOnly,
      avgDays: avgDays,
      mode: mode,
      targetDay: mode === "daily" ? targetDay : undefined,
    }
  );

  // Fetch breakout candidates (public endpoint, no auth)
  const { data: breakoutData, error: breakoutError } = useBreakoutStreamersQuery();

  // Build a lookup map keyed by player_id for O(1) merge
  const breakoutMap = useMemo(() => {
    if (!breakoutData?.candidates) return new Map<number, BreakoutCandidateResp>();
    return new Map(
      breakoutData.candidates.map((c) => [c.beneficiary.player_id, c])
    );
  }, [breakoutData?.candidates]);

  // Filter and sort streamers, merging in breakout context where applicable
  const filteredStreamers = useMemo(() => {
    if (!data?.streamers) return [];

    const pickupDay = data.target_day ?? data.current_day_index;

    const enriched = data.streamers.map((player) => ({
      ...player,
      breakout_context: breakoutMap.get(player.player_id),
    }));

    const filtered = enriched.filter((player) => {
      const matchesSearch = player.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const matchesPosition =
        selectedPositions.size === 0 ||
        player.valid_positions.some((pos) =>
          selectedPositions.has(pos as Position)
        );

      const hasDailyPickupB2b =
        player.game_days.includes(pickupDay) &&
        player.game_days.includes(pickupDay + 1);
      const hasB2b = mode === "daily" ? hasDailyPickupB2b : player.has_b2b;
      const matchesB2b = !b2bOnly || hasB2b;

      const matchesBreakout = !breakoutOnly || !!player.breakout_context;

      return matchesSearch && matchesPosition && matchesB2b && matchesBreakout;
    });

    // Sort all streamers by composite streamer_score (OPP, B2B, and regular ranked fairly)
    return filtered.sort((a, b) => b.streamer_score - a.streamer_score);
  }, [data?.streamers, data?.target_day, data?.current_day_index, breakoutMap, searchQuery, selectedPositions, b2bOnly, breakoutOnly, mode]);

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

  const handleModeChange = (next: StreamerMode) => {
    setMode(next);
    if (next === "week") {
      setTargetDay(null);
    }
  };

  // Everything the sheet holds; search stays (it's in the phone header, not the sheet).
  const clearAllFilters = () => {
    setTargetDay(null);
    setB2bOnly(false);
    setBreakoutOnly(false);
    setAvgDays(DEFAULT_AVG_DAYS);
    clearPositionFilters();
  };

  const selectPlayer = (player: StreamerPlayer) =>
    setSelectedPlayer({
      playerId: player.player_id,
      playerName: player.name,
      playerTeam: player.team,
      position: formatPositions(player.valid_positions),
      breakoutContext: player.breakout_context,
    });

  // Generate day options for daily mode day picker
  const dayOptions = useMemo(() => {
    if (!data) return [];
    return Array.from({ length: data.game_span }, (_, i) => ({
      value: i,
      label: `Day ${i + 1}${i === data.current_day_index ? " (Today)" : ""}`,
    }));
  }, [data]);

  const breakoutAvailable = breakoutMap.size > 0;
  const breakoutUnavailableReason = breakoutError
    ? `Breakout data unavailable — ${userMessage(breakoutError)}`
    : !breakoutData
      ? "Breakout candidates are still loading."
      : "No breakout candidates right now.";

  const activeFilterCount = countActiveStreamerFilters({
    mode,
    targetDay,
    b2bOnly,
    breakoutOnly,
    avgDays,
    selectedPositions,
  });

  // The selected team id is persisted; without the teams list it can't become a league.
  if (teamsError && !selectedTeamData) {
    return (
      <Card variant="panel" className="w-full">
        <QueryErrorState error={teamsError} onRetry={refetchTeams} />
      </Card>
    );
  }

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
      <Card variant="panel" className="w-full">
        <QueryErrorState error={error} onRetry={() => refetch()} isRetrying={isFetching} />
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
  const pickupDay = data.target_day ?? data.current_day_index;
  const isCatValue = data.value_kind === "cat_value";
  const valueHeader = isCatValue ? `Cat value (L${avgDays})` : `${avgDays}D Avg`;

  const filterProps = {
    mode,
    searchQuery,
    targetDay,
    b2bOnly,
    breakoutOnly,
    avgDays,
    selectedPositions,
    setSearchQuery,
    setTargetDay,
    setB2bOnly,
    setBreakoutOnly,
    setAvgDays,
    togglePosition,
    clearPositionFilters,
    dayOptions,
    breakoutAvailable,
    breakoutUnavailableReason,
  };

  /** Per-row flags shared by the table and the card list. */
  const rowFlags = (player: StreamerPlayer, index: number) => {
    const hasDailyPickupB2b =
      player.game_days.includes(pickupDay) &&
      player.game_days.includes(pickupDay + 1);
    // Show a visual divider between the breakout group and regular streamers
    const prevHasBreakout =
      index > 0 && !!filteredStreamers[index - 1].breakout_context;
    return {
      showB2bBadge: mode === "daily" ? hasDailyPickupB2b : player.has_b2b,
      showDivider: prevHasBreakout && !player.breakout_context,
    };
  };

  return (
    <div className="flex flex-col w-full gap-3">
      {/* Filters (md and up): one wrapping row */}
      <Card variant="panel" className="hidden md:block p-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Toggle */}
          <ModeTabs
            mode={mode}
            onChange={handleModeChange}
            listClassName="h-8"
            triggerClassName="text-xs px-3"
          />
          <StreamerFilterControls layout="inline" {...filterProps} />
        </div>
      </Card>

      {/* Filters (phones): mode + sheet trigger, then a full-width search */}
      <div className="md:hidden flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ModeTabs
            mode={mode}
            onChange={handleModeChange}
            className="min-w-0 flex-1"
            listClassName="grid h-10 w-full grid-cols-2"
            triggerClassName="text-xs"
          />
          <Button
            variant="outline"
            className="h-10 shrink-0 px-3 text-xs"
            onClick={() => setFiltersOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal />
            Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
      </div>
      <StreamerFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        activeCount={activeFilterCount}
        onClearAll={clearAllFilters}
        {...filterProps}
      />

      {/* Info Bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground px-1">
        <span>
          Matchup {data.matchup_number} &middot;{" "}
          {mode === "daily"
            ? `Day ${(data.target_day ?? data.current_day_index) + 1} Pickup`
            : `Day ${data.current_day_index + 1} of ${data.game_span}`}
          {breakoutOnly && " · Breakout view"}
        </span>
        {mode === "week" && data.teams_with_b2b.length > 0 && (
          <span className="hidden sm:inline">B2B: {data.teams_with_b2b.join(", ")}</span>
        )}
        <span className="ml-auto">
          {filteredStreamers.length} of {data.streamers.length} players
        </span>
      </div>

      {/* Streamers: card list on phones, table from md up */}
      <Card variant="panel" className="overflow-hidden">
        <CardContent className="p-0">
          {isMobile ? (
            filteredStreamers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No streamers found matching your filters.
              </p>
            ) : (
              <ul className="list-none">
                {filteredStreamers.map((player: StreamerPlayer, index: number) => {
                  const { showB2bBadge, showDivider } = rowFlags(player, index);
                  return (
                    <StreamerCard
                      key={player.player_id}
                      player={player}
                      index={index}
                      showB2bBadge={showB2bBadge}
                      showDivider={showDivider}
                      totalDays={totalDays}
                      currentDay={data.current_day_index}
                      onSelect={selectPlayer}
                    />
                  );
                })}
              </ul>
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] text-center pl-3">#</TableHead>
                  <TableHead className="min-w-[200px]">Player</TableHead>
                  <TableHead className="w-[50px] text-center">Team</TableHead>
                  <TableHead className="w-[120px]">Pos</TableHead>
                  <TableHead className="w-[70px] text-right whitespace-nowrap">
                    {isCatValue ? (
                      <HintPopover content={CAT_VALUE_TITLE} contentClassName="max-w-[260px]">
                        <span>{valueHeader}</span>
                      </HintPopover>
                    ) : (
                      valueHeader
                    )}
                  </TableHead>
                  <TableHead className="w-[70px] text-center">
                    <HintPopover content="Games remaining in the matchup">
                      <span>Games left</span>
                    </HintPopover>
                  </TableHead>
                  <TableHead className="text-center">
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
                  filteredStreamers.map((player: StreamerPlayer, index: number) => {
                    const { showB2bBadge, showDivider } = rowFlags(player, index);

                    return (
                      <Fragment key={player.player_id}>
                        {showDivider && (
                          <TableRow className="h-px pointer-events-none">
                            <TableCell colSpan={7} className="p-0 bg-border" />
                          </TableRow>
                        )}
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50 transition-colors border-l-2 border-l-transparent hover:border-l-primary"
                          onClick={() => selectPlayer(player)}
                        >
                          <TableCell className="text-center pl-3 font-mono text-xs text-muted-foreground tabular-nums">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <PlayerHeadshot
                                playerId={player.nba_player_id}
                                name={player.name}
                                size="xs"
                              />
                              <span className="font-medium text-sm">{player.name}</span>
                              {showB2bBadge && (
                                <Badge
                                  variant="secondary"
                                  className="text-[11px]"
                                >
                                  B2B
                                </Badge>
                              )}
                              {player.breakout_context && (
                                <OppBadge context={player.breakout_context} />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {player.team}
                          </TableCell>
                          <TableCell>
                            <PositionBadges positions={player.valid_positions} />
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums whitespace-nowrap">
                            {player.avg_points_last_n !== null
                              ? player.avg_points_last_n.toFixed(1)
                              : "-"}
                            {player.avg_source === "baseline" && (
                              <PriorSeasonBadge className="ml-1" />
                            )}
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
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Player Stats Dialog */}
      <Dialog
        open={!!selectedPlayer}
        onOpenChange={() => setSelectedPlayer(null)}
      >
        <DialogContent className="max-w-[900px]">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedPlayer?.playerName ?? "Player"} details</DialogTitle>
            <DialogDescription>
              Detailed stats and performance history.
            </DialogDescription>
          </DialogHeader>
          {selectedPlayer && (
            <div className="flex flex-col gap-4">
              {selectedPlayer.breakoutContext && (
                <BreakoutContextSection context={selectedPlayer.breakoutContext} />
              )}
              <PlayerStatDisplay
                playerId={selectedPlayer.playerId}
                playerName={selectedPlayer.playerName}
                playerTeam={selectedPlayer.playerTeam}
                provider={provider}
                position={selectedPlayer.position}
              />
            </div>
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
