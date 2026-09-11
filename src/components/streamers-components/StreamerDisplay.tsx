"use client";

import { useState, useMemo, Fragment } from "react";
import { Search, SlidersHorizontal, UserMinus } from "lucide-react";

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
import { HintPopover } from "@/components/ui/hint";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkeletonTable, type SkeletonColumn } from "@/components/ui/skeleton-table";
import { QueryErrorState, StaleBadge } from "@/components/ui/query-error";

import { WeekSchedule, WeekScheduleHeader } from "./WeekSchedule";
import { BreakoutContextSection } from "./BreakoutContextSection";
import { OppBadge, PositionBadges, PriorSeasonBadge, WaiversBadge } from "./StreamerBadges";
import { AddButton, StreamerCard } from "./StreamerCard";
import { AddStreamerDialog } from "./AddStreamerDialog";
import {
  StreamerFilterControls,
  countActiveStreamerFilters,
  DEFAULT_AVG_DAYS,
  type Position,
} from "./StreamerFilterControls";
import { StreamerFilterSheet } from "./StreamerFilterSheet";
import { PlayerCardDialog } from "@/components/player-card/PlayerCardDialog";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import { useTeamLineupQuery } from "@/hooks/useLineupEditor";
import { STREAMERS_PAGE_QUERY, useStreamersQuery } from "@/hooks/useStreamers";
import { useBreakoutStreamersQuery } from "@/hooks/useBreakoutStreamers";
import { CAT_VALUE_TITLE } from "@/lib/category-format";
import { formatPositions } from "@/lib/positions";
import { addBlockedReason, dropBlockedReason, streamerCaption } from "@/lib/roster-transaction";
import { cn } from "@/lib/utils";
import { PlayerHeadshot } from "@/components/terminal/shared";
import { userMessage } from "@/lib/api-error";
import type { StreamerPlayer, StreamerMode } from "@/types/streamer";
import type { BreakoutCandidateResp } from "@/types/breakout";

interface SelectedPlayer {
  player: StreamerPlayer;
  position: string | null;
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

/**
 * Mirrors the loaded table's own TableHead widths and alignment (see the
 * TableHeader further down) so the rows sit on the same grid before and after
 * the data arrives, and nothing reflows when the values land.
 *
 * `canAdd` comes from the selected team's provider, not the response, so the
 * Add column is known up front — the loaded table counts it (`columnCount`)
 * and the loading one has to as well. The value column's real label depends on
 * the response (`value_kind`, `avgDays`), so it shows a generic word at the
 * same fixed width.
 */
function streamerSkeletonColumns(canAdd: boolean): SkeletonColumn[] {
  const columns: SkeletonColumn[] = [
    { header: "#", className: "w-[50px] text-center pl-3", numeric: true, placeholder: "--" },
    { header: "Player", className: "min-w-[200px]" },
    { header: "Team", className: "w-[50px] text-center" },
    { header: "Pos", className: "w-[120px]" },
    { header: "Value", className: "w-[70px] text-right whitespace-nowrap", numeric: true },
    { header: "Games left", className: "w-[70px] text-center", numeric: true, placeholder: "-" },
    { header: "Schedule", className: "text-center" },
  ];
  if (canAdd) columns.push({ header: "", className: "w-[56px] text-center" });
  return columns;
}

export default function StreamerDisplay() {
  const {
    teamId: selectedTeam,
    team: selectedTeamData,
    provider,
    teamsError,
    refetchTeams,
  } = useSelectedTeam();
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
  // The add/drop dialog keeps its subject while it animates closed, so the
  // target and the open flag are separate. `{ player: null }` is a straight drop.
  const [txnTarget, setTxnTarget] = useState<{ player: StreamerPlayer | null } | null>(null);
  const [txnOpen, setTxnOpen] = useState(false);

  // Fetch streamers
  const streamers = useStreamersQuery(selectedTeam, {
    ...STREAMERS_PAGE_QUERY,
    b2bOnly,
    avgDays,
    mode,
    targetDay: mode === "daily" ? targetDay : null,
  });
  // The result while it may still be missing; `data` below is the narrowed one.
  const found = streamers.data;

  // Today's ESPN board, fetched once for the page: it decides whether an add
  // is offered at all (and why not). Off for every other provider.
  const canAdd = provider === "espn";
  const lineup = useTeamLineupQuery(selectedTeam, provider);
  const board = lineup.data ?? null;
  const addReason = (player: StreamerPlayer) =>
    addBlockedReason({ player, state: board, provider });
  const openAdd = (player: StreamerPlayer) => {
    setTxnTarget({ player });
    setTxnOpen(true);
  };
  const openDrop = () => {
    setTxnTarget({ player: null });
    setTxnOpen(true);
  };
  const dropReason = dropBlockedReason({ state: board, provider });

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
    if (!found?.streamers) return [];

    const pickupDay = found.target_day ?? found.current_day_index;

    const enriched = found.streamers.map((player) => ({
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
  }, [found?.streamers, found?.target_day, found?.current_day_index, breakoutMap, searchQuery, selectedPositions, b2bOnly, breakoutOnly, mode]);

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
    setSelectedPlayer({ player, position: formatPositions(player.valid_positions) });

  // Generate day options for daily mode day picker. Before opening night no
  // day is today, so none is labelled as such.
  const dayOptions = useMemo(() => {
    if (!found) return [];
    return Array.from({ length: found.game_span }, (_, i) => ({
      value: i,
      label: `Day ${i + 1}${!found.upcoming && i === found.current_day_index ? " (Today)" : ""}`,
    }));
  }, [found]);

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

  if (streamers.isPending) {
    return (
      <Card variant="panel" className="w-full">
        <CardContent className="p-4">
          <SkeletonTable rows={10} columns={streamerSkeletonColumns(canAdd)} />
        </CardContent>
      </Card>
    );
  }

  // No result at all: the first load failed, or `unwrap` turned an empty
  // success envelope into EMPTY_RESULT (no matchup on the calendar). A refetch
  // that failed after a result keeps the table and flags it stale instead.
  if (found === undefined) {
    return (
      <Card variant="panel" className="w-full">
        <QueryErrorState
          error={streamers.error ?? new Error("Streamers unavailable")}
          onRetry={() => streamers.refetch()}
          isRetrying={streamers.isFetching}
        />
      </Card>
    );
  }

  const data = found;
  const totalDays = data.game_span;
  const pickupDay = data.target_day ?? data.current_day_index;
  // -1 = no day is today: the schedule strip marks nothing as today or past.
  const currentDay = data.upcoming ? -1 : data.current_day_index;
  const isCatValue = data.value_kind === "cat_value";
  const valueHeader = isCatValue ? `Cat value (L${avgDays})` : `${avgDays}D Avg`;
  const columnCount = canAdd ? 8 : 7;

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
          {canAdd && (
            <DropPlayerButton reason={dropReason} onClick={openDrop} className="ml-auto h-8 text-xs" />
          )}
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
          {canAdd && (
            <DropPlayerButton reason={dropReason} onClick={openDrop} className="h-10 shrink-0 px-3 text-xs" iconOnly />
          )}
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
          {streamerCaption(data, mode)}
          {breakoutOnly && " · Breakout view"}
        </span>
        {mode === "week" && data.teams_with_b2b.length > 0 && (
          <span className="hidden sm:inline">B2B: {data.teams_with_b2b.join(", ")}</span>
        )}
        {streamers.isRefetchError && (
          <StaleBadge
            dataUpdatedAt={streamers.dataUpdatedAt}
            isFetching={streamers.isFetching}
            error={streamers.error}
          />
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
                      currentDay={currentDay}
                      onSelect={selectPlayer}
                      onAdd={canAdd ? openAdd : undefined}
                      addDisabledReason={canAdd ? addReason(player) : null}
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
                        currentDay={currentDay}
                      />
                    </div>
                  </TableHead>
                  {canAdd && (
                    <TableHead className="w-[56px] text-center">
                      <span className="sr-only">Add</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStreamers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columnCount}
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
                            <TableCell colSpan={columnCount} className="p-0 bg-border" />
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
                              {player.acquisition_status === "waivers" && (
                                <WaiversBadge until={player.waivers_until} />
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
                                currentDay={currentDay}
                              />
                            </div>
                          </TableCell>
                          {canAdd && (
                            <TableCell className="py-1 pr-3 text-center">
                              <AddButton
                                name={player.name}
                                disabledReason={addReason(player)}
                                onClick={() => openAdd(player)}
                                className="h-8 w-8"
                              />
                            </TableCell>
                          )}
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

      <PlayerCardDialog
        open={!!selectedPlayer}
        onOpenChange={(open) => {
          if (!open) setSelectedPlayer(null);
        }}
        playerId={selectedPlayer?.player.player_id}
        playerName={selectedPlayer?.player.name}
        playerTeam={selectedPlayer?.player.team}
        provider={provider}
        position={selectedPlayer?.position}
        aside={
          selectedPlayer?.player.breakout_context ? (
            <BreakoutContextSection context={selectedPlayer.player.breakout_context} />
          ) : undefined
        }
        actions={
          selectedPlayer && canAdd ? (
            <AddToRosterButton
              reason={addReason(selectedPlayer.player)}
              waiversUntil={
                selectedPlayer.player.acquisition_status === "waivers"
                  ? selectedPlayer.player.waivers_until
                  : undefined
              }
              onClick={() => {
                const target = selectedPlayer.player;
                setSelectedPlayer(null);
                openAdd(target);
              }}
            />
          ) : undefined
        }
      />

      {txnTarget && (
        <AddStreamerDialog
          player={txnTarget.player}
          teamId={selectedTeam}
          open={txnOpen}
          onOpenChange={setTxnOpen}
        />
      )}
    </div>
  );
}

/** "Drop a player": opens the transaction dialog with nobody to add; disabled with the reason as a hint. */
function DropPlayerButton({
  reason,
  onClick,
  className,
  iconOnly = false,
}: {
  reason: string | null;
  onClick: () => void;
  className?: string;
  /** Phones: the icon alone, with the label for assistive tech. */
  iconOnly?: boolean;
}) {
  const button = (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={!!reason}
      className={className}
      aria-label={iconOnly ? "Drop a player" : undefined}
    >
      <UserMinus className="h-4 w-4" />
      {!iconOnly && "Drop a player"}
    </Button>
  );
  if (!reason) return button;
  return (
    <HintPopover content={<p className="text-xs">{reason}</p>} contentClassName="max-w-[240px]">
      <span className={cn("inline-flex", iconOnly ? "shrink-0" : "ml-auto")}>{button}</span>
    </HintPopover>
  );
}

/** The stats dialog's "Add to roster": disabled with the reason as a hint when the add is refused. */
function AddToRosterButton({
  reason,
  waiversUntil,
  onClick,
}: {
  reason: string | null;
  /** Set only when the player is on waivers; renders the badge beside the button. */
  waiversUntil?: string | null;
  onClick: () => void;
}) {
  const button = (
    <Button type="button" onClick={onClick} disabled={!!reason}>
      Add to roster
    </Button>
  );
  return (
    <span className="flex items-center gap-2 max-sm:justify-end">
      {waiversUntil !== undefined && <WaiversBadge until={waiversUntil} />}
      {reason ? (
        <HintPopover content={<p className="text-xs">{reason}</p>} contentClassName="max-w-[240px]">
          <span className="inline-flex">{button}</span>
        </HintPopover>
      ) : (
        button
      )}
    </span>
  );
}
