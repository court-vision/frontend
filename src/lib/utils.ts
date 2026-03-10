import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get today's date in YYYY-MM-DD format using the fantasy scheduling convention:
 * before 2 AM ET counts as yesterday — aligns with when ESPN's batch update runs
 * (~2 AM ET), after which the new fantasy day is active.
 *
 * Note: for NBA *game* dates (live stats, scoreboard), use getTodayDate() from
 * useGames.ts which uses a simple midnight ET flip.
 */
export function getTodayET(): string {
  const now = new Date();
  const etParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);

  const year = etParts.find((p) => p.type === "year")!.value;
  const month = etParts.find((p) => p.type === "month")!.value;
  const day = etParts.find((p) => p.type === "day")!.value;
  const hour = parseInt(etParts.find((p) => p.type === "hour")!.value);

  if (hour < 2) {
    const yesterday = new Date(parseInt(year), parseInt(month) - 1, parseInt(day) - 1);
    return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  }

  return `${year}-${month}-${day}`;
}
