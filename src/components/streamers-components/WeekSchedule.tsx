"use client";

import { ChevronDown } from "lucide-react";

interface WeekScheduleProps {
  gameDays: number[];
  totalDays: number;
  currentDay: number;
  showHeader?: boolean;
}

export function WeekSchedule({
  gameDays,
  totalDays,
  currentDay,
  showHeader = false,
}: WeekScheduleProps) {
  const gameDaysSet = new Set(gameDays);

  return (
    <div className="flex flex-col items-center gap-0.5">
      {showHeader && (
        <div className="flex gap-1">
          {Array.from({ length: totalDays }, (_, i) => (
            <div
              key={i}
              className="w-5 h-4 flex items-center justify-center text-[10px] text-muted-foreground"
            >
              {i === currentDay ? (
                <ChevronDown className="w-3 h-3 text-primary" />
              ) : (
                <span>{i + 1}</span>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        {Array.from({ length: totalDays }, (_, i) => {
          const hasGame = gameDaysSet.has(i);
          const isCurrentDay = i === currentDay;
          const isPastDay = i < currentDay;

          return (
            <div
              key={i}
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
              title={`Day ${i + 1}${hasGame ? " - Game" : " - Off"}${
                isCurrentDay ? " (Today)" : ""
              }`}
            >
              {!showHeader && (i + 1)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface WeekScheduleHeaderProps {
  totalDays: number;
  currentDay: number;
}

export function WeekScheduleHeader({
  totalDays,
  currentDay,
}: WeekScheduleHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex gap-1">
        {Array.from({ length: totalDays }, (_, i) => (
          <div
            key={i}
            className="w-5 h-4 flex items-center justify-center"
          >
            {i === currentDay ? (
              <ChevronDown className="w-3 h-3 text-primary" />
            ) : (
              <span className="text-[10px] text-muted-foreground">{i + 1}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
