"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SlimGene, SlimPlayer, Lineup } from "@/types/lineup";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useLineup } from "@/app/context/LineupContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Save } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LineupDisplay({ lineup }: { lineup: Lineup }) {
  const { saveLineup } = useLineup();
  const [currentDay, setCurrentDay] = useState(0);

  const handleSaveLineup = () => {
    saveLineup(lineup);
  };

  if (lineup.Lineup.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 px-4">
        Select your number of streaming slots and matchup week to generate
        an optimized lineup.
      </div>
    );
  }

  const totalDays = lineup.Lineup.length;
  const canGoPrev = currentDay > 0;
  const canGoNext = currentDay < totalDays - 1;

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      {/* Header with improvement score and save button */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-tertiary flex items-center gap-1">
            +{lineup.Improvement}
            <TrendingUp className="h-5 w-5" />
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="h-5 w-5 rounded-full border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">
                  ?
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[250px] text-center">
                <p>
                  Expected additional points compared to your current lineup
                  with no acquisitions.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Button
          onClick={handleSaveLineup}
          variant="outline"
          size="sm"
          className="gap-1.5"
        >
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>

      {/* Lineup Card with integrated navigation */}
      <Card className="border border-border overflow-hidden">
        {/* Day Navigation Header */}
        <CardHeader className="py-3 px-4 bg-muted/50 border-b border-border">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentDay((d) => d - 1)}
              disabled={!canGoPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                Day {lineup.Lineup[currentDay].Day + 1}
              </span>
              <span className="text-xs text-muted-foreground">
                ({currentDay + 1} of {totalDays})
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentDay((d) => d + 1)}
              disabled={!canGoNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {/* Day indicator dots */}
          <div className="flex justify-center gap-1.5 mt-2">
            {lineup.Lineup.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentDay(idx)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  idx === currentDay
                    ? "w-4 bg-primary"
                    : "w-1.5 bg-border hover:bg-muted-foreground"
                )}
              />
            ))}
          </div>
        </CardHeader>

        {/* Roster Table */}
        <CardContent className="p-0">
          <LineupDayContent gene={lineup.Lineup[currentDay]} />
        </CardContent>
      </Card>

      {/* Help text */}
      <div className="text-xs text-muted-foreground space-y-1 px-1">
        <p>
          <span className="text-tertiary font-medium">+</span> New acquisition
          &nbsp;&bull;&nbsp;
          <span className="text-destructive font-medium">−</span> Removed from team
        </p>
      </div>
    </div>
  );
}

function LineupDayContent({ gene }: { gene: SlimGene }) {
  const orderToDisplay = [
    "PG",
    "SG",
    "SF",
    "PF",
    "C",
    "G",
    "F",
    "UT1",
    "UT2",
    "UT3",
  ];

  const isPlayerNew = (player: SlimPlayer) => {
    return gene.Additions.some((addition) => addition.Name === player.Name);
  };

  return (
    <div>
      {/* Roster Section */}
      <div className="px-4 py-2 bg-card">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Roster
        </h3>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="w-10 py-2 text-xs">Pos</TableHead>
              <TableHead className="py-2 text-xs">Player</TableHead>
              <TableHead className="w-12 py-2 text-xs">Team</TableHead>
              <TableHead className="w-12 py-2 text-xs text-right">Avg</TableHead>
              <TableHead className="w-8 py-2"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderToDisplay.map((position: string) => {
              const player = gene.Roster[position];
              if (player) {
                const isNew = isPlayerNew(player);
                return (
                  <TableRow
                    key={position}
                    className={cn(
                      "border-border",
                      isNew && "bg-tertiary/5"
                    )}
                  >
                    <TableCell className="py-1.5 text-xs font-medium text-muted-foreground">
                      {position}
                    </TableCell>
                    <TableCell className="py-1.5 text-sm">{player.Name}</TableCell>
                    <TableCell className="py-1.5 text-xs text-muted-foreground">
                      {player.Team}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-right tabular-nums">
                      {player.AvgPoints}
                    </TableCell>
                    <TableCell className="py-1.5 text-center">
                      {isNew && (
                        <span className="text-tertiary font-bold">+</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              }
              return (
                <TableRow key={position} className="border-border">
                  <TableCell className="py-1.5 text-xs font-medium text-muted-foreground">
                    {position}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Skeleton className="h-4 w-8" />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Skeleton className="h-4 w-8" />
                  </TableCell>
                  <TableCell className="py-1.5" />
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Removals Section */}
      {gene.Removals.length > 0 && (
        <div className="px-4 py-2 bg-muted/30 border-t border-border">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Removals
          </h3>
          <Table>
            <TableBody>
              {gene.Removals.map((player: SlimPlayer, index: number) => (
                <TableRow key={index} className="border-border bg-destructive/5">
                  <TableCell className="py-1.5 text-sm">{player.Name}</TableCell>
                  <TableCell className="py-1.5 text-xs text-muted-foreground w-12">
                    {player.Team}
                  </TableCell>
                  <TableCell className="py-1.5 text-xs text-right tabular-nums w-12">
                    {player.AvgPoints}
                  </TableCell>
                  <TableCell className="py-1.5 text-center w-8">
                    <span className="text-destructive font-bold">−</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// Exported for use in dialog views
export { LineupDayContent };

// Standalone lineup viewer component for dialogs
export function LineupViewer({
  lineup,
  className,
}: {
  lineup: Lineup;
  className?: string;
}) {
  const [currentDay, setCurrentDay] = useState(0);

  if (lineup.Lineup.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No lineup data available.
      </div>
    );
  }

  const totalDays = lineup.Lineup.length;
  const canGoPrev = currentDay > 0;
  const canGoNext = currentDay < totalDays - 1;

  return (
    <div className={cn("w-full", className)}>
      <Card className="border border-border overflow-hidden">
        {/* Day Navigation Header */}
        <CardHeader className="py-3 px-4 bg-muted/50 border-b border-border">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentDay((d) => d - 1)}
              disabled={!canGoPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                Day {lineup.Lineup[currentDay].Day + 1}
              </span>
              <span className="text-xs text-muted-foreground">
                ({currentDay + 1} of {totalDays})
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentDay((d) => d + 1)}
              disabled={!canGoNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {/* Day indicator dots */}
          <div className="flex justify-center gap-1.5 mt-2">
            {lineup.Lineup.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentDay(idx)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  idx === currentDay
                    ? "w-4 bg-primary"
                    : "w-1.5 bg-border hover:bg-muted-foreground"
                )}
              />
            ))}
          </div>
        </CardHeader>

        {/* Roster Table */}
        <CardContent className="p-0">
          <LineupDayContent gene={lineup.Lineup[currentDay]} />
        </CardContent>
      </Card>
    </div>
  );
}
