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
import { useStandingsQuery } from "@/hooks/useStandings";
import type { StandingsPlayer } from "@/types/standings";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown,
  Search,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
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

export default function StandingsDisplay() {
  const { data: standings, isLoading } = useStandingsQuery();
  const { open: openCommandPalette } = useCommandPalette();
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [sortedStandings, setSortedStandings] = useState<StandingsPlayer[]>([]);
  const [sortConfig, setSortConfig] = useState({
    key: "total_fpts",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableSectionElement>(null);

  // Filter standings based on search query
  const filteredStandings = sortedStandings.filter((player) =>
    player.player_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate pagination values
  const totalPages = Math.ceil(filteredStandings.length / PLAYERS_PER_PAGE);
  const startIndex = (currentPage - 1) * PLAYERS_PER_PAGE;
  const endIndex = startIndex + PLAYERS_PER_PAGE;
  const paginatedStandings = filteredStandings.slice(startIndex, endIndex);

  // Reset to page 1 and highlighted index when search query changes
  useEffect(() => {
    setCurrentPage(1);
    setHighlightedIndex(-1);
  }, [searchQuery]);

  // Reset highlighted index when page changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [currentPage]);

  // Make sure to update sortedStandings when standings changes
  useEffect(() => {
    if (!standings) return;
    setSortedStandings(standings);
  }, [standings]);

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
          return next >= paginatedStandings.length ? 0 : next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? paginatedStandings.length - 1 : next;
        });
      } else if (e.key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault();
        const player = paginatedStandings[highlightedIndex];
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
  }, [paginatedStandings, highlightedIndex]);

  const handleSort = (key: "total_fpts" | "avg_fpts") => {
    let direction = "desc";

    // If clicking the same column, toggle direction
    if (sortConfig.key === key) {
      direction = sortConfig.direction === "desc" ? "asc" : "desc";
    }

    const sorted = [...sortedStandings].sort((a, b) => {
      if (direction === "desc") {
        return b[key] - a[key];
      }
      return a[key] - b[key];
    });

    setSortedStandings(sorted);
    setSortConfig({ key, direction });
  };

  const handlePlayerClick = (player: StandingsPlayer) => {
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
      return <ArrowUpDown size={16} className="text-gray-400" />;
    }
    return (
      <ArrowUpDown
        size={16}
        className={`text-primary ${
          sortConfig.direction === "asc" ? "rotate-180" : ""
        }`}
      />
    );
  };

  if (isLoading) {
    return (
      <Card className="mt-5 w-full">
        <CardContent className="p-6">
          <SkeletonTable rows={10} columns={5} />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Search Bar */}
      <div className="mt-5 flex items-center justify-center gap-4 w-full">
        <div className="relative w-1/2 max-w-6xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search players... (press / to focus)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {/* <Button
          variant="outline"
          className="hidden sm:flex items-center gap-2 text-muted-foreground"
          onClick={openCommandPalette}
        >
          <Search className="h-4 w-4" />
          <span>Commands</span>
          <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button> */}
      </div>

      <Card className="mt-5 w-full">
        <CardContent className="flex flex-col justify-center mb-[-20px] w-full">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Rank</TableHead>
                <TableHead className="w-[50%] text-center">Name</TableHead>
                <TableHead
                  className="text-center cursor-pointer hover:bg-muted"
                  onClick={() => handleSort("total_fpts")}
                >
                  <div className="flex items-center justify-center gap-2">
                    Total FPTS
                    {getSortIcon("total_fpts")}
                  </div>
                </TableHead>
                <TableHead
                  className="text-center cursor-pointer hover:bg-muted"
                  onClick={() => handleSort("avg_fpts")}
                >
                  <div className="flex items-center justify-center gap-2">
                    Average FPTS/G
                    {getSortIcon("avg_fpts")}
                  </div>
                </TableHead>
                <TableHead className="w-[100px] text-center">
                  Rank Change
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody ref={tableRef}>
              {paginatedStandings.map(
                (player: StandingsPlayer, index: number) => {
                  const isHighlighted = index === highlightedIndex;
                  return (
                    <TableRow
                      key={player.id}
                      className={`text-center cursor-pointer ${
                        isHighlighted ? "bg-muted" : ""
                      }`}
                      onClick={() => handlePlayerClick(player)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <TableCell>{player.rank}</TableCell>
                      <TableCell>{player.player_name}</TableCell>
                      <TableCell>{player.total_fpts}</TableCell>
                      <TableCell>
                        {Math.round(player.avg_fpts * 10) / 10}
                      </TableCell>
                      <TableCell className="flex justify-center items-center space-x-1">
                        {player.rank_change}
                        <Separator orientation="vertical" />
                        {player.rank_change > 0 ? (
                          <TrendingUp className="text-green-500" size={20} />
                        ) : player.rank_change < 0 ? (
                          <TrendingDown className="text-red-500" size={20} />
                        ) : (
                          <Minus className="text-gray-500" size={20} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between py-4">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-
                {Math.min(endIndex, filteredStandings.length)} of{" "}
                {filteredStandings.length} players
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
