"use client";

import { Search } from "lucide-react";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { StreamerMode } from "@/types/streamer";

export const POSITIONS = ["PG", "SG", "SF", "PF", "C", "G", "F"] as const;
export type Position = (typeof POSITIONS)[number];

export const DEFAULT_AVG_DAYS = 7;

export const AVG_DAYS_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 14, label: "Last 14 days" },
  { value: 30, label: "Last 30 days" },
] as const;

export interface DayOption {
  value: number;
  label: string;
}

export interface StreamerFilterState {
  mode: StreamerMode;
  searchQuery: string;
  targetDay: number | null;
  b2bOnly: boolean;
  breakoutOnly: boolean;
  avgDays: number;
  selectedPositions: Set<Position>;
}

export interface StreamerFilterActions {
  setSearchQuery: (query: string) => void;
  setTargetDay: (day: number | null) => void;
  setB2bOnly: (on: boolean) => void;
  setBreakoutOnly: (on: boolean) => void;
  setAvgDays: (days: number) => void;
  togglePosition: (pos: Position) => void;
  clearPositionFilters: () => void;
}

export interface StreamerFilterControlsProps
  extends StreamerFilterState,
    StreamerFilterActions {
  dayOptions: DayOption[];
  /** False until breakout candidates have loaded (or when there are none); disables "Breakout Only". */
  breakoutAvailable: boolean;
  /** Why "Breakout Only" is disabled; shown as helper text in the stacked layout. */
  breakoutUnavailableReason?: string;
  /**
   * `inline`: the desktop filter card's single wrapping row (fragment of the
   * existing controls, markup unchanged). `stacked`: labelled sections for the
   * phone sheet; search is omitted because it lives in the phone header.
   */
  layout: "inline" | "stacked";
}

/** Filters that differ from their defaults. Search is excluded: it's visible in the header, not the sheet. */
export function countActiveStreamerFilters(
  state: Pick<
    StreamerFilterState,
    "mode" | "targetDay" | "b2bOnly" | "breakoutOnly" | "avgDays" | "selectedPositions"
  >
): number {
  let count = 0;
  if (state.mode === "daily" && state.targetDay !== null) count++;
  if (state.b2bOnly) count++;
  if (state.breakoutOnly) count++;
  if (state.avgDays !== DEFAULT_AVG_DAYS) count++;
  if (state.selectedPositions.size > 0) count++;
  return count;
}

function Field({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-6 items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

export function StreamerFilterControls({
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
  layout,
}: StreamerFilterControlsProps) {
  if (layout === "inline") {
    return (
      <>
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

        {/* Daily mode: Day Picker */}
        {mode === "daily" && (
          <Select
            value={targetDay?.toString() ?? "today"}
            onValueChange={(val) =>
              setTargetDay(val === "today" ? null : parseInt(val))
            }
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              {dayOptions.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* B2B Only Toggle */}
        <Button
          variant={b2bOnly ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setB2bOnly(!b2bOnly)}
        >
          B2B Only
        </Button>

        {/* Breakout Only Toggle */}
        <Button
          variant={breakoutOnly ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setBreakoutOnly(!breakoutOnly)}
          disabled={!breakoutAvailable}
          title={!breakoutAvailable ? breakoutUnavailableReason : undefined}
        >
          Breakout Only
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
                className="cursor-pointer hover:bg-primary/80 text-[11px]"
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
              className="text-[11px] h-5 px-1.5"
            >
              Clear
            </Button>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {mode === "daily" && (
        <Field label="Pickup day">
          <Select
            value={targetDay?.toString() ?? "today"}
            onValueChange={(val) =>
              setTargetDay(val === "today" ? null : parseInt(val))
            }
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              {dayOptions.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field label="Average window">
        <Select
          value={avgDays.toString()}
          onValueChange={(val) => setAvgDays(parseInt(val))}
        >
          <SelectTrigger className="h-10 w-full">
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
      </Field>

      <Field label="Only show">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={b2bOnly ? "default" : "outline"}
            className="h-10 text-xs"
            onClick={() => setB2bOnly(!b2bOnly)}
            aria-pressed={b2bOnly}
          >
            B2B Only
          </Button>
          <Button
            variant={breakoutOnly ? "default" : "outline"}
            className="h-10 text-xs"
            onClick={() => setBreakoutOnly(!breakoutOnly)}
            disabled={!breakoutAvailable}
            aria-pressed={breakoutOnly}
          >
            Breakout Only
          </Button>
        </div>
        {!breakoutAvailable && breakoutUnavailableReason && (
          <p className="text-xs text-muted-foreground">{breakoutUnavailableReason}</p>
        )}
      </Field>

      <Field
        label="Positions"
        action={
          selectedPositions.size > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearPositionFilters}
              className="h-6 px-2 text-[11px]"
            >
              Clear
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map((pos) => {
            const selected = selectedPositions.has(pos);
            return (
              <button
                key={pos}
                type="button"
                aria-pressed={selected}
                onClick={() => togglePosition(pos)}
                className={cn(
                  badgeVariants({ variant: selected ? "default" : "outline" }),
                  "h-9 px-3 text-xs"
                )}
              >
                {pos}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}
