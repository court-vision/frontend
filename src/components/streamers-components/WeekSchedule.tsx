"use client";

import { ChevronDown } from "lucide-react";

interface WeekScheduleProps {
  gameDays: number[];
  totalDays: number;
  currentDay: number;
  showHeader?: boolean;
}

function ScheduleRow({
  startIndex,
  count,
  gameDaysSet,
  currentDay,
  showHeader,
}: {
  startIndex: number;
  count: number;
  gameDaysSet: Set<number>;
  currentDay: number;
  showHeader: boolean;
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
                className="w-5 h-4 flex items-center justify-center text-[10px] text-muted-foreground"
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

          return (
            <div
              key={dayIndex}
              className={`w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-medium transition-colors
                ${
                  hasGame
                    ? isCurrentDay
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1"
                      : isPastDay
                      ? "bg-muted-foreground/50 text-muted"
                      : "bg-primary text-primary-foreground"
                    : isCurrentDay
                    ? "bg-muted border-2 border-primary text-muted-foreground"
                    : "bg-muted border border-border text-muted-foreground"
                }
              `}
              title={`Day ${dayIndex + 1}${hasGame ? " - Game" : " - Off"}${
                isCurrentDay ? " (Today)" : ""
              }`}
            >
              {!showHeader && (dayIndex + 1)}
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
}: WeekScheduleProps) {
  const gameDaysSet = new Set(gameDays);

  if (totalDays <= 7) {
    return (
      <ScheduleRow
        startIndex={0}
        count={totalDays}
        gameDaysSet={gameDaysSet}
        currentDay={currentDay}
        showHeader={showHeader}
      />
    );
  }

  // Split into rows of 7
  const rows: { startIndex: number; count: number }[] = [];
  for (let i = 0; i < totalDays; i += 7) {
    rows.push({ startIndex: i, count: Math.min(7, totalDays - i) });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <ScheduleRow
          key={row.startIndex}
          startIndex={row.startIndex}
          count={row.count}
          gameDaysSet={gameDaysSet}
          currentDay={currentDay}
          showHeader={showHeader}
        />
      ))}
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
              className="w-5 h-4 flex items-center justify-center"
            >
              {dayIndex === currentDay ? (
                <ChevronDown className="w-3 h-3 text-primary" />
              ) : (
                <span className="text-[10px] text-muted-foreground">
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
