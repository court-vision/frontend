"use client";

import { cn } from "@/lib/utils";

interface DayNavigationBarProps {
  matchupPeriodStart: string;
  matchupPeriodEnd: string;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  todayDate: string;
}

function getDaysInRange(start: string, end: string): { date: string; dayAbbr: string; dateLabel: string }[] {
  const days: { date: string; dayAbbr: string; dateLabel: string }[] = [];
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);

  const current = new Date(startDate);
  while (current <= endDate) {
    const iso = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    const dayAbbr = current.toLocaleDateString("en-US", { weekday: "short" });
    const dateLabel = current.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    days.push({ date: iso, dayAbbr, dateLabel });
    current.setDate(current.getDate() + 1);
  }
  return days;
}

export function DayNavigationBar({
  matchupPeriodStart,
  matchupPeriodEnd,
  selectedDate,
  onSelectDate,
  todayDate,
}: DayNavigationBarProps) {
  const days = getDaysInRange(matchupPeriodStart, matchupPeriodEnd);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
      {/* Overview pill */}
      <button
        onClick={() => onSelectDate(null)}
        className={cn(
          "shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
          selectedDate === null
            ? "bg-primary text-primary-foreground"
            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        Week
      </button>

      <div className="w-px h-5 bg-border shrink-0" />

      {days.map(({ date, dayAbbr, dateLabel }) => {
        const isToday = date === todayDate;
        const isPast = date < todayDate;
        const isSelected = date === selectedDate;

        return (
          <button
            key={date}
            onClick={() => {
              if (isToday || isSelected) {
                onSelectDate(null);
              } else {
                onSelectDate(date);
              }
            }}
            className={cn(
              "shrink-0 flex flex-col items-center px-2.5 py-1 rounded-md text-xs transition-colors min-w-[52px]",
              isSelected
                ? "bg-primary text-primary-foreground"
                : isToday
                  ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  : isPast
                    ? "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    : "bg-muted/30 text-muted-foreground/60 hover:bg-muted/50 hover:text-muted-foreground"
            )}
          >
            <span className="font-medium leading-tight">{dayAbbr}</span>
            <span className={cn(
              "text-[10px] leading-tight mt-0.5",
              isSelected ? "text-primary-foreground/80" : "opacity-60"
            )}>
              {dateLabel}
            </span>
            {/* Day type indicator dot */}
            <div className="mt-0.5">
              {isToday ? (
                <span className={cn(
                  "block w-1.5 h-1.5 rounded-full",
                  isSelected ? "bg-primary-foreground animate-pulse" : "bg-emerald-500 animate-pulse"
                )} />
              ) : isPast ? (
                <span className={cn(
                  "block w-1 h-1 rounded-full",
                  isSelected ? "bg-primary-foreground" : "bg-muted-foreground/40"
                )} />
              ) : (
                <span className={cn(
                  "block w-1 h-1 rounded-full border",
                  isSelected ? "border-primary-foreground" : "border-muted-foreground/30"
                )} />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
