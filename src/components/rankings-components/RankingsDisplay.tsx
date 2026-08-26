"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableHeader,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRankingsListQuery } from "@/hooks/useRankings";
import { useRankingsParams } from "@/hooks/useRankingsParams";
import type { RankingsMeta, RankingsPlayer, RankingsWindow } from "@/types/rankings";
import type { ScoringFormat } from "@/types/scoring";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown,
  Search,
  Loader2,
} from "lucide-react";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { QueryErrorState } from "@/components/ui/query-error";
import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogContent,
  DialogHeader,
  DialogClose,
} from "../ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "../ui/pagination";
import { Input } from "../ui/input";
import PlayerStatDisplay from "./PlayerStatDisplay";
import { cn } from "@/lib/utils";
import { DEFAULT_9CAT, formatCategoryValue, polarityGlyph } from "@/lib/category-format";
import { RANKINGS_WINDOWS, isStandard9Cat } from "@/lib/rankings-params";
import { seasonLabel } from "@/lib/season";

const PLAYERS_PER_PAGE = 50;

type SortDirection = "asc" | "desc";

interface ColumnDef {
  key: string;
  label: string;
  /** Header title (tooltip) */
  title?: string;
  align?: "left" | "right" | "center";
  /** Applied to both the header and body cells of the column. */
  className?: string;
  /** Header cell only. */
  headClassName?: string;
  /** Body cells only. */
  cellClassName?: string;
  sortable?: boolean;
  /** Direction used the first time this column is clicked. */
  defaultDirection?: SortDirection;
  value?: (p: RankingsPlayer) => number | null;
  render: (p: RankingsPlayer) => ReactNode;
}

function RankChange({ change }: { change: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      <span className="font-mono text-xs tabular-nums">
        {change > 0 ? `+${change}` : change}
      </span>
      {change > 0 ? (
        <TrendingUp className="h-3.5 w-3.5 text-status-win" />
      ) : change < 0 ? (
        <TrendingDown className="h-3.5 w-3.5 text-status-loss" />
      ) : (
        <Minus className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </div>
  );
}

// Below `md` the Rank + Player columns stay put while the numeric columns
// scroll under them, so they need opaque backgrounds (the row's own hover /
// highlight colours included). Everything is `max-md:` — desktop gets no CSS.
const STICKY_LEAD = "max-md:sticky max-md:z-10";
const STICKY_LEAD_CELL =
  "max-md:bg-card max-md:group-hover:bg-muted max-md:group-data-[highlighted]:bg-muted";
// Header cells: `TableHead`'s translucent `bg-muted/30` painted over an opaque
// card base as one layer (a flat gradient), so it matches the other headers.
// Written as an arbitrary property: tailwind-merge would otherwise drop
// `bg-card` in favour of a `bg-gradient-*` utility.
const STICKY_LEAD_HEAD =
  "max-md:bg-card max-md:[background-image:linear-gradient(hsl(var(--muted)/0.3),hsl(var(--muted)/0.3))]";
/** Rank column width on phones; the Player column sticks right after it. */
const RANK_W = "max-md:w-[48px] max-md:px-2";

const RANK_COLUMN: ColumnDef = {
  key: "rank",
  label: "Rank",
  className: cn("w-[60px] pl-4", RANK_W, "max-md:left-0", STICKY_LEAD),
  headClassName: STICKY_LEAD_HEAD,
  cellClassName: STICKY_LEAD_CELL,
  render: (p) => (
    <span className="font-mono text-xs text-muted-foreground tabular-nums">{p.rank}</span>
  ),
};

const PLAYER_COLUMN: ColumnDef = {
  key: "player_name",
  label: "Player",
  className: cn("max-md:left-[48px]", STICKY_LEAD),
  headClassName: STICKY_LEAD_HEAD,
  cellClassName: STICKY_LEAD_CELL,
  render: (p) => (
    <span className="font-medium text-sm max-md:block max-md:max-w-[150px] max-md:truncate">
      {p.player_name}
    </span>
  ),
};

const POINTS_COLUMNS: ColumnDef[] = [
  RANK_COLUMN,
  PLAYER_COLUMN,
  {
    key: "total_fpts",
    label: "Total FPTS",
    align: "right",
    sortable: true,
    defaultDirection: "desc",
    value: (p) => p.total_fpts,
    render: (p) => <span className="font-mono text-sm tabular-nums">{p.total_fpts}</span>,
  },
  {
    key: "avg_fpts",
    label: "Avg FPTS/G",
    align: "right",
    sortable: true,
    defaultDirection: "desc",
    value: (p) => p.avg_fpts,
    render: (p) => (
      <span className="font-mono text-sm tabular-nums">{Math.round(p.avg_fpts * 10) / 10}</span>
    ),
  },
  {
    key: "rank_change",
    label: "Change",
    align: "center",
    className: "w-[100px] pr-4",
    render: (p) => <RankChange change={p.rank_change} />,
  },
];

function zTint(z: number | undefined): string {
  if (z === undefined) return "";
  if (z >= 1) return "text-status-win";
  if (z <= -1) return "text-status-loss";
  return "";
}

/** Category columns follow `meta.categories` (or the standard 9-cat while meta loads). */
function buildColumns(format: ScoringFormat, meta: RankingsMeta | null): ColumnDef[] {
  if (format !== "categories") return POINTS_COLUMNS;
  const defs = meta?.categories?.length ? meta.categories : DEFAULT_9CAT;
  const categoryColumns: ColumnDef[] = defs.map((d, i) => ({
    key: `cat:${d.key}`,
    label: `${d.label}${polarityGlyph(d)}`,
    title: d.higher_is_better ? `${d.label} — higher is better` : `${d.label} — lower is better`,
    align: "right",
    className: cn("w-[64px]", i === defs.length - 1 && "pr-4"),
    sortable: true,
    defaultDirection: d.higher_is_better ? "desc" : "asc",
    value: (p) => p.categories?.[d.key] ?? null,
    render: (p) => (
      <span className={cn("font-mono text-xs tabular-nums", zTint(p.category_z?.[d.key]))}>
        {formatCategoryValue(p.categories?.[d.key], d)}
      </span>
    ),
  }));
  return [
    RANK_COLUMN,
    {
      ...PLAYER_COLUMN,
      render: (p) => (
        <div className="flex items-center gap-1.5 min-w-0 max-md:max-w-[150px]">
          <span className="font-medium text-sm truncate">{p.player_name}</span>
          <span className="text-[10px] font-mono text-muted-foreground/60 uppercase shrink-0">{p.team}</span>
        </div>
      ),
    },
    {
      key: "score",
      label: "Z",
      title: "Sum of per-category z-scores over the ranked pool",
      align: "right",
      className: "w-[72px]",
      sortable: true,
      defaultDirection: "desc",
      value: (p) => p.score ?? null,
      render: (p) => (
        <span className="font-mono text-sm tabular-nums font-semibold">
          {p.score != null ? p.score.toFixed(1) : "—"}
        </span>
      ),
    },
    {
      key: "gp",
      label: "GP",
      align: "right",
      className: "w-[48px]",
      sortable: true,
      defaultDirection: "desc",
      value: (p) => p.gp ?? null,
      render: (p) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{p.gp ?? "—"}</span>
      ),
    },
    ...categoryColumns,
  ];
}

function alignClass(align: ColumnDef["align"]): string {
  return align === "right" ? "text-right" : align === "center" ? "text-center" : "";
}

export default function RankingsDisplay() {
  const { params, setParams, source, leagueName } = useRankingsParams();
  const { data, isLoading, isFetching, error, refetch } = useRankingsListQuery(params);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: SortDirection } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableSectionElement>(null);

  const players = useMemo(() => data?.players ?? [], [data]);
  const meta = data?.meta ?? null;
  const isCategories = params.format === "categories";
  const columns = useMemo(() => buildColumns(params.format, meta), [params.format, meta]);

  // Default sort: the ranking key for the format (rank order from the API).
  const activeSort = sortConfig ?? {
    key: isCategories ? "score" : "total_fpts",
    direction: "desc" as SortDirection,
  };

  const sortedRankings = useMemo(() => {
    const col = columns.find((c) => c.key === activeSort.key);
    if (!col?.value) return players;
    const getter = col.value;
    const sign = activeSort.direction === "desc" ? -1 : 1;
    return [...players].sort((a, b) => {
      const av = getter(a);
      const bv = getter(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1; // nulls last in either direction
      if (bv === null) return -1;
      return (av - bv) * sign;
    });
  }, [players, columns, activeSort.key, activeSort.direction]);

  // Filter rankings based on search query
  const filteredRankings = useMemo(
    () =>
      sortedRankings.filter((player) =>
        player.player_name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [sortedRankings, searchQuery]
  );

  // Calculate pagination values
  const totalPages = Math.ceil(filteredRankings.length / PLAYERS_PER_PAGE);
  const startIndex = (currentPage - 1) * PLAYERS_PER_PAGE;
  const endIndex = startIndex + PLAYERS_PER_PAGE;
  const paginatedRankings = filteredRankings.slice(startIndex, endIndex);

  // Reset to page 1 and highlighted index when search query or params change
  useEffect(() => {
    setCurrentPage(1);
    setHighlightedIndex(-1);
  }, [searchQuery, params.format, params.window]);

  // Sorting resets when the format changes (columns differ)
  useEffect(() => {
    setSortConfig(null);
  }, [params.format]);

  // Reset highlighted index when page changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [currentPage]);

  // Keyboard navigation for search results
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search input with "/" key
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Only handle arrow keys when search input is focused or we have a highlighted row
      const isSearchFocused = document.activeElement === searchInputRef.current;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev + 1;
          return next >= paginatedRankings.length ? 0 : next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? paginatedRankings.length - 1 : next;
        });
      } else if (e.key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault();
        const player = paginatedRankings[highlightedIndex];
        if (player) {
          setSelectedPlayerId(player.id);
        }
      } else if (e.key === "Escape" && isSearchFocused) {
        searchInputRef.current?.blur();
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [paginatedRankings, highlightedIndex]);

  const handleSort = (col: ColumnDef) => {
    if (!col.sortable) return;
    const preferred = col.defaultDirection ?? "desc";
    setSortConfig((prev) => {
      if (prev?.key === col.key) {
        return { key: col.key, direction: prev.direction === "desc" ? "asc" : "desc" };
      }
      return { key: col.key, direction: preferred };
    });
  };

  const handlePlayerClick = (player: RankingsPlayer) => {
    setSelectedPlayerId(player.id);
  };

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      ) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

  const getSortIcon = (columnKey: string) => {
    if (activeSort.key !== columnKey) {
      return <ArrowUpDown size={14} className="text-muted-foreground" />;
    }
    return (
      <ArrowUpDown
        size={14}
        className={`text-primary ${activeSort.direction === "asc" ? "rotate-180" : ""}`}
      />
    );
  };

  // "Day 12 of 2026–27", or "2026–27 · no games yet" before opening night.
  const seasonCaption = meta?.season
    ? typeof meta.season_day === "number"
      ? `Day ${meta.season_day} of ${seasonLabel(meta.season)}`
      : `${seasonLabel(meta.season)} · no games yet`
    : null;
  // The backend applies no games-played floor unless the user opted in.
  const minGamesCaption = params.minGames !== null ? ` · min ${params.minGames} GP` : "";
  const categoriesCaption = isCategories
    ? source === "league" && leagueName
      ? `Using ${leagueName}'s categories`
      : params.categories && !isStandard9Cat(params.categories)
        ? `Custom categories (${params.categories.length})`
        : "Standard 9-cat"
    : null;

  const toolbar = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      {/* Search Bar */}
      <div className="relative max-w-sm flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          placeholder="Search players...  (press / to focus)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10 md:h-8 text-xs"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Format toggle */}
        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          {(["points", "categories"] as ScoringFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setParams({ format: f })}
              className={cn(
                "px-2.5 h-10 md:h-8 font-medium transition-colors",
                params.format === f
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "points" ? "Points" : "Categories"}
            </button>
          ))}
        </div>

        {/* Window select */}
        <Select
          value={params.window === null ? "season" : String(params.window)}
          onValueChange={(v) =>
            setParams({ window: v === "season" ? null : (Number(v) as RankingsWindow) })
          }
        >
          <SelectTrigger className="h-10 md:h-8 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANKINGS_WINDOWS.map((w) => (
              <SelectItem key={w.label} value={w.value === null ? "season" : String(w.value)}>
                {w.long}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isFetching && !isLoading && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );

  const caption = (
    <p className="text-[11px] text-muted-foreground/70 px-0.5">
      {isCategories ? (
        <>
          {categoriesCaption} · ranked by summed z-scores
          {seasonCaption ? ` · ${seasonCaption}` : ""}
          {minGamesCaption}
          {meta ? ` · ${meta.pool_size} players` : ""}
        </>
      ) : (
        <>
          Fantasy points{params.window ? ` · last ${params.window} days` : " · full season"}
          {seasonCaption ? ` · ${seasonCaption}` : ""}
        </>
      )}
      {meta?.as_of ? ` · as of ${meta.as_of}` : ""}
    </p>
  );

  if (isLoading) {
    return (
      <>
        {toolbar}
        <Card variant="panel" className="w-full">
          <CardContent className="p-4">
            <SkeletonTable rows={10} columns={isCategories ? 12 : 5} />
          </CardContent>
        </Card>
      </>
    );
  }

  // With `keepPreviousData`, a failed window switch keeps the last table on
  // screen (the global toast reports it); only an empty screen gets the card.
  if (error && !data) {
    return (
      <>
        {toolbar}
        <Card variant="panel" className="w-full">
          <CardContent className="p-0">
            <QueryErrorState error={error} onRetry={() => refetch()} isRetrying={isFetching} />
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      {toolbar}
      {caption}

      <Card variant="panel" className="w-full max-md:bg-card">
        <CardContent className={cn("p-0 transition-opacity", isFetching && "opacity-70")}>
          {/* Phones: the table scrolls inside its own box (both axes) so the
              header and the Rank/Player columns can stick; desktop keeps page
              scrolling. `vh` fallback for browsers without `dvh`. */}
          <Table containerClassName="max-md:max-h-[calc(100vh-var(--chrome-h)-9rem)] max-md:supports-[height:100dvh]:max-h-[calc(100dvh-var(--chrome-h)-9rem)]">
            {/* Collapsed borders don't travel with a sticky thead; the shadow is its bottom rule. */}
            <TableHeader className="max-md:sticky max-md:top-0 max-md:z-20 max-md:bg-card max-md:shadow-[0_1px_0_hsl(var(--border))]">
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    title={col.title}
                    className={cn(
                      alignClass(col.align),
                      col.className,
                      col.headClassName,
                      col.sortable && "cursor-pointer hover:bg-muted/50 transition-colors"
                    )}
                    onClick={() => handleSort(col)}
                  >
                    {col.sortable ? (
                      <div
                        className={cn(
                          "flex items-center gap-1.5",
                          col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : ""
                        )}
                      >
                        {col.label}
                        {getSortIcon(col.key)}
                      </div>
                    ) : (
                      col.label
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody ref={tableRef}>
              {paginatedRankings.map((player: RankingsPlayer, index: number) => {
                const isHighlighted = index === highlightedIndex;
                return (
                  <TableRow
                    key={player.id}
                    className={`cursor-pointer transition-colors ${
                      isHighlighted
                        ? "bg-muted border-l-2 border-l-primary"
                        : "border-l-2 border-l-transparent"
                    }`}
                    data-highlighted={isHighlighted || undefined}
                    onClick={() => handlePlayerClick(player)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(alignClass(col.align), col.className, col.cellClassName)}
                      >
                        {col.render(player)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
              {paginatedRankings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">
                    {players.length === 0
                      ? data?.message || "No rankings available for this window yet."
                      : "No players match your search."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col gap-2 px-4 py-3 border-t border-border sm:flex-row sm:items-center sm:justify-between">
              <p className="hidden text-xs text-muted-foreground sm:block">
                {startIndex + 1}–{Math.min(endIndex, filteredRankings.length)}{" "}
                of {filteredRankings.length}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  {getPageNumbers().map((page, index) =>
                    page === "ellipsis" ? (
                      <PaginationItem key={`ellipsis-${index}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem
                        key={page}
                        // Phones: first / current / last only, with prev/next icons.
                        className={cn(
                          page !== 1 && page !== totalPages && page !== currentPage && "hidden sm:block"
                        )}
                      >
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
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
            <PlayerStatDisplay playerId={selectedPlayerId} idType="nba" />
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" size="sm">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
