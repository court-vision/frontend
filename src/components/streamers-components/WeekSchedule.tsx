"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface WeekScheduleProps {
  gameDays: number[];
  totalDays: number;
  currentDay: number;
  showHeader?: boolean;
  /**
   * Cells become buttons and a tapped one writes a single caption line under
   * the strip ("Day 4 · Game · Today") — the phone stand-in for `title`,
   * which touch never shows. Desktop keeps the plain cells.
   */
  interactive?: boolean;
}

interface RowSpan {
  startIndex: number;
  count: number;
}

/** Rows of at most seven days. */
function splitRows(totalDays: number): RowSpan[] {
  if (totalDays <= 7) return [{ startIndex: 0, count: totalDays }];
  const rows: RowSpan[] = [];
  for (let i = 0; i < totalDays; i += 7) {
    rows.push({ startIndex: i, count: Math.min(7, totalDays - i) });
  }
  return rows;
}

function cellTitle(dayIndex: number, hasGame: boolean, isCurrentDay: boolean): string {
  return `Day ${dayIndex + 1}${hasGame ? " - Game" : " - Off"}${isCurrentDay ? " (Today)" : ""}`;
}

function cellCaption(dayIndex: number, hasGame: boolean, isCurrentDay: boolean): string {
  return `Day ${dayIndex + 1} · ${hasGame ? "Game" : "Off"}${isCurrentDay ? " · Today" : ""}`;
}

function ScheduleRow({
  startIndex,
  count,
  gameDaysSet,
  currentDay,
  showHeader,
  selectedDay,
  onSelectDay,
}: {
  startIndex: number;
  count: number;
  gameDaysSet: Set<number>;
  currentDay: number;
  showHeader: boolean;
  selectedDay: number | null;
  /** Present only in interactive mode. */
  onSelectDay?: (dayIndex: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      {showHeader && (
        <div className="flex gap-1">
          {Array.from({ length: count }, (_, i) => {
            const dayIndex = startIndex + i;
            return (
              <div
                key={dayIndex}
                className="w-8 h-4 flex items-center justify-center text-[11px] text-muted-foreground md:w-5"
              >
                {dayIndex === currentDay ? (
                  <ChevronDown className="w-3 h-3 text-primary" />
                ) : (
                  <span>{dayIndex + 1}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex gap-1">
        {Array.from({ length: count }, (_, i) => {
          const dayIndex = startIndex + i;
          const hasGame = gameDaysSet.has(dayIndex);
          const isCurrentDay = dayIndex === currentDay;
          const isPastDay = dayIndex < currentDay;
          const isSelected = selectedDay === dayIndex;

          const className = cn(
            "w-8 h-8 rounded-sm flex items-center justify-center text-xs font-medium transition-colors md:w-5 md:h-5 md:text-[11px]",
            hasGame
              ? isCurrentDay
                ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1"
                : isPastDay
                  ? "bg-muted-foreground/50 text-muted"
                  : "bg-primary text-primary-foreground"
              : isCurrentDay
                ? "bg-muted border-2 border-primary text-muted-foreground"
                : "bg-muted border border-border text-muted-foreground",
            isSelected && "outline outline-2 outline-offset-1 outline-foreground/70"
          );
          const title = cellTitle(dayIndex, hasGame, isCurrentDay);
          const label = !showHeader && dayIndex + 1;

          if (onSelectDay) {
            return (
              <button
                key={dayIndex}
                type="button"
                className={className}
                title={title}
                aria-label={title}
                aria-pressed={isSelected}
                onClick={() => onSelectDay(dayIndex)}
              >
                {label}
              </button>
            );
          }

          return (
            <div key={dayIndex} className={className} title={title}>
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WeekSchedule({
  gameDays,
  totalDays,
  currentDay,
  showHeader = false,
  interactive = false,
}: WeekScheduleProps) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const gameDaysSet = new Set(gameDays);
  const rows = splitRows(totalDays);
  const onSelectDay = interactive
    ? (dayIndex: number) =>
        setSelectedDay((prev) => (prev === dayIndex ? null : dayIndex))
    : undefined;

  const strip =
    rows.length === 1 ? (
      <ScheduleRow
        startIndex={rows[0].startIndex}
        count={rows[0].count}
        gameDaysSet={gameDaysSet}
        currentDay={currentDay}
        showHeader={showHeader}
        selectedDay={selectedDay}
        onSelectDay={onSelectDay}
      />
    ) : (
      <div className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <ScheduleRow
            key={row.startIndex}
            startIndex={row.startIndex}
            count={row.count}
            gameDaysSet={gameDaysSet}
            currentDay={currentDay}
            showHeader={showHeader}
            selectedDay={selectedDay}
            onSelectDay={onSelectDay}
          />
        ))}
      </div>
    );

  if (!interactive) return strip;

  const caption =
    selectedDay === null
      ? ""
      : cellCaption(selectedDay, gameDaysSet.has(selectedDay), selectedDay === currentDay);

  return (
    <div className="flex flex-col items-start gap-1">
      {strip}
      {/* Fixed height so tapping a cell never shifts the layout under the finger. */}
      <p
        className="h-4 text-[11px] leading-4 text-muted-foreground"
        aria-live="polite"
        data-schedule-caption
      >
        {caption}
      </p>
    </div>
  );
}

interface WeekScheduleHeaderProps {
  totalDays: number;
  currentDay: number;
}

function HeaderRow({
  startIndex,
  count,
  currentDay,
  label,
}: {
  startIndex: number;
  count: number;
  currentDay: number;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      {label && (
        <span className="text-[9px] text-muted-foreground/70 font-medium">{label}</span>
      )}
      <div className="flex gap-1">
        {Array.from({ length: count }, (_, i) => {
          const dayIndex = startIndex + i;
          return (
            <div
              key={dayIndex}
              className="w-8 h-4 flex items-center justify-center md:w-5"
            >
              {dayIndex === currentDay ? (
                <ChevronDown className="w-3 h-3 text-primary" />
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  {dayIndex + 1}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WeekScheduleHeader({
  totalDays,
  currentDay,
}: WeekScheduleHeaderProps) {
  if (totalDays <= 7) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <HeaderRow startIndex={0} count={totalDays} currentDay={currentDay} />
      </div>
    );
  }

  // Split into rows of 7 with week labels
  const rows: { startIndex: number; count: number; label: string }[] = [];
  let weekNum = 1;
  for (let i = 0; i < totalDays; i += 7) {
    rows.push({
      startIndex: i,
      count: Math.min(7, totalDays - i),
      label: `Wk ${weekNum}`,
    });
    weekNum++;
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      {rows.map((row) => (
        <HeaderRow
          key={row.startIndex}
          startIndex={row.startIndex}
          count={row.count}
          currentDay={currentDay}
          label={row.label}
        />
      ))}
    </div>
  );
}
