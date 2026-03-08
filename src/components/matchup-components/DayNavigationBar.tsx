"use client";

import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface DayNavigationBarProps {
  matchupPeriodStart: string;
  matchupPeriodEnd: string;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  todayDate: string;
}

function getDaysInRange(
  start: string,
  end: string
): { date: string; dayAbbr: string; dateNum: string }[] {
  const days: { date: string; dayAbbr: string; dateNum: string }[] = [];
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const current = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);

  while (current <= endDate) {
    const iso = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    days.push({
      date: iso,
      dayAbbr: current
        .toLocaleDateString("en-US", { weekday: "short" })
        .slice(0, 2)
        .toUpperCase(),
      dateNum: String(current.getDate()),
    });
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
  const n = days.length;
  const todayIdx = days.findIndex((d) => d.date === todayDate);
  // Today's fixed position on the progress track
  const todayPct = todayIdx >= 0 ? ((todayIdx + 0.5) / n) * 100 : -1;
  // Scrubber dot position: follows selectedDate, falls back to today
  const selectedIdx = selectedDate ? days.findIndex((d) => d.date === selectedDate) : -1;
  const dotPct = selectedIdx >= 0 ? ((selectedIdx + 0.5) / n) * 100 : todayPct;

  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const getDateFromClientX = useCallback(
    (clientX: number): string | null => {
      if (!trackRef.current) return null;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const idx = Math.min(n - 1, Math.floor(pct * n));
      return days[idx]?.date ?? null;
    },
    [days, n]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      const date = getDateFromClientX(e.clientX);
      if (date) onSelectDate(date === todayDate ? null : date);
    },
    [getDateFromClientX, onSelectDate, todayDate]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const date = getDateFromClientX(e.clientX);
      if (date) onSelectDate(date === todayDate ? null : date);
    },
    [getDateFromClientX, onSelectDate, todayDate]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    // Outer 2-col grid: [All button | Day cells + progress track]
    // This ensures the progress track is naturally aligned with the day cells
    <div
      className="grid border border-border/40 rounded-lg overflow-visible bg-card/20"
      style={{ gridTemplateColumns: "minmax(44px, 52px) 1fr" }}
    >
      {/* ── "All / Week" column ───────────────────────────────────────────── */}
      <button
        onClick={() => onSelectDate(null)}
        className={cn(
          "relative flex flex-col items-center justify-center py-2.5 px-2 gap-0.5 rounded-l-lg",
          "border-r border-border/40 transition-colors duration-150",
          selectedDate === null
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30"
        )}
      >
        <span
          className={cn(
            "absolute top-0 inset-x-0 h-[2px] rounded-br-none rounded-tl-lg transition-colors duration-200",
            selectedDate === null ? "bg-primary" : "bg-transparent"
          )}
        />
        <span className="text-[9px] font-mono tracking-[0.14em] uppercase leading-none opacity-55">
          WK
        </span>
        <span className="text-[11px] font-medium leading-none mt-[3px]">All</span>
      </button>

      {/* ── Right column: day cells + progress track ─────────────────────── */}
      <div className="flex flex-col">
        {/* Day buttons */}
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
        >
          {days.map(({ date, dayAbbr, dateNum }) => {
            const isToday = date === todayDate;
            const isPast = date < todayDate;
            const isFuture = date > todayDate;
            const isSelected = date === selectedDate;

            return (
              <button
                key={date}
                onClick={() => {
                  if (isToday || isSelected) onSelectDate(null);
                  else onSelectDate(date);
                }}
                className={cn(
                  "relative flex flex-col items-center justify-center py-2.5 px-1 gap-[3px]",
                  "border-r border-border/25 last:border-r-0 transition-colors duration-150",
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : isToday
                      ? "bg-emerald-500/[0.06] text-emerald-400 hover:bg-emerald-500/[0.12]"
                      : isPast
                        ? "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                        : "text-muted-foreground/35 hover:bg-muted/15 hover:text-muted-foreground/60"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0 inset-x-0 h-[2px] transition-colors duration-200",
                    isSelected
                      ? "bg-primary"
                      : isToday
                        ? "bg-emerald-500"
                        : "bg-transparent"
                  )}
                />
                <span className="text-[9px] font-mono tracking-wide leading-none">
                  {dayAbbr}
                </span>
                <span
                  className={cn(
                    "text-[13px] font-semibold tabular-nums leading-none",
                    isFuture && !isSelected ? "opacity-40" : ""
                  )}
                >
                  {dateNum}
                </span>
                <span className="h-[5px] flex items-center justify-center">
                  {isToday ? (
                    <span className="block w-[5px] h-[5px] rounded-full bg-emerald-500 animate-pulse" />
                  ) : isPast ? (
                    <span
                      className={cn(
                        "block w-[3px] h-[3px] rounded-full",
                        isSelected ? "bg-primary/70" : "bg-muted-foreground/25"
                      )}
                    />
                  ) : (
                    <span className="block w-[3px] h-[3px] rounded-full border border-muted-foreground/20" />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Progress track + draggable scrubber ──────────────────────── */}
        {todayPct >= 0 && (
          <div
            ref={trackRef}
            className={cn(
              "relative h-[14px] flex items-center px-0 select-none",
              isDragging ? "cursor-grabbing" : "cursor-pointer"
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Track background */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-border/40 rounded-full" />

            {/* Filled portion up to today */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-[2px] left-0 bg-primary/25 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${todayPct}%` }}
            />

            {/* Fixed today marker (always at today's position) */}
            {selectedIdx >= 0 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[5px] h-[5px] rounded-full bg-emerald-500/40 pointer-events-none"
                style={{ left: `${todayPct}%` }}
              />
            )}

            {/* Draggable scrubber dot */}
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full pointer-events-none",
                "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
                "transition-[left] duration-150 ease-out",
                isDragging ? "w-[10px] h-[10px]" : "w-[7px] h-[7px]"
              )}
              style={{ left: `${dotPct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
