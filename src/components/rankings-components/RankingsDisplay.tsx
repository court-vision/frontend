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
import { useRankingsQuery } from "@/hooks/useRankings";
import type { RankingsPlayer } from "@/types/rankings";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown,
  Search,
} from "lucide-react";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { useEffect, useState, useRef, useCallback } from "react";
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
import { useCommandPalette } from "@/providers/CommandPaletteProvider";

const PLAYERS_PER_PAGE = 50;

export default function RankingsDisplay() {
  const { data: rankings, isLoading } = useRankingsQuery();
  const { open: openCommandPalette } = useCommandPalette();
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [sortedRankings, setSortedRankings] = useState<RankingsPlayer[]>([]);
  const [sortConfig, setSortConfig] = useState({
    key: "total_fpts",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableSectionElement>(null);

  // Filter rankings based on search query
  const filteredRankings = sortedRankings.filter((player) =>
    player.player_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate pagination values
  const totalPages = Math.ceil(filteredRankings.length / PLAYERS_PER_PAGE);
  const startIndex = (currentPage - 1) * PLAYERS_PER_PAGE;
  const endIndex = startIndex + PLAYERS_PER_PAGE;
  const paginatedRankings = filteredRankings.slice(startIndex, endIndex);

  // Reset to page 1 and highlighted index when search query changes
  useEffect(() => {
    setCurrentPage(1);
    setHighlightedIndex(-1);
  }, [searchQuery]);

  // Reset highlighted index when page changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [currentPage]);

  // Make sure to update sortedRankings when rankings changes
  useEffect(() => {
    if (!rankings) return;
    setSortedRankings(rankings);
  }, [rankings]);

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

  const handleSort = (key: "total_fpts" | "avg_fpts") => {
    let direction = "desc";

    // If clicking the same column, toggle direction
    if (sortConfig.key === key) {
      direction = sortConfig.direction === "desc" ? "asc" : "desc";
    }

    const sorted = [...sortedRankings].sort((a, b) => {
      if (direction === "desc") {
        return b[key] - a[key];
      }
      return a[key] - b[key];
    });

    setSortedRankings(sorted);
    setSortConfig({ key, direction });
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
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown size={14} className="text-muted-foreground" />;
    }
    return (
      <ArrowUpDown
        size={14}
        className={`text-primary ${
          sortConfig.direction === "asc" ? "rotate-180" : ""
        }`}
      />
    );
  };

  if (isLoading) {
    return (
      <Card variant="panel" className="w-full">
        <CardContent className="p-4">
          <SkeletonTable rows={10} columns={5} />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          placeholder="Search players...  (press / to focus)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-8 text-xs"
        />
      </div>

      <Card variant="panel" className="w-full">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px] pl-4">Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead
                  className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort("total_fpts")}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    Total FPTS
                    {getSortIcon("total_fpts")}
                  </div>
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort("avg_fpts")}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    Avg FPTS/G
                    {getSortIcon("avg_fpts")}
                  </div>
                </TableHead>
                <TableHead className="w-[100px] text-center pr-4">
                  Change
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody ref={tableRef}>
              {paginatedRankings.map(
                (player: RankingsPlayer, index: number) => {
                  const isHighlighted = index === highlightedIndex;
                  return (
                    <TableRow
                      key={player.id}
                      className={`cursor-pointer transition-colors ${
                        isHighlighted
                          ? "bg-muted border-l-2 border-l-primary"
                          : "border-l-2 border-l-transparent"
                      }`}
                      onClick={() => handlePlayerClick(player)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <TableCell className="pl-4 font-mono text-xs text-muted-foreground tabular-nums">
                        {player.rank}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {player.player_name}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {player.total_fpts}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {Math.round(player.avg_fpts * 10) / 10}
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-mono text-xs tabular-nums">
                            {player.rank_change > 0
                              ? `+${player.rank_change}`
                              : player.rank_change}
                          </span>
                          {player.rank_change > 0 ? (
                            <TrendingUp className="h-3.5 w-3.5 text-status-win" />
                          ) : player.rank_change < 0 ? (
                            <TrendingDown className="h-3.5 w-3.5 text-status-loss" />
                          ) : (
                            <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
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
                      <PaginationItem key={page}>
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
