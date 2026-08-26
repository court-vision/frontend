/**
 * Compact "how long ago" copy for live badges and the status bar.
 *
 * Pure so it can be unit-tested and re-rendered on a timer without React.
 */

/** "just now", "12 s ago", "3 min ago", "2 h ago", "4 d ago"; "never" for an unset timestamp. */
export function formatRelativeTime(timestampMs: number, nowMs: number = Date.now()): string {
  if (!timestampMs || timestampMs <= 0) return "never";
  const elapsed = Math.max(0, nowMs - timestampMs);
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}
