import type { PlayerStatusData } from "@/types/player";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * How old an injury report is, for the line beside its badge: "today",
 * "yesterday", "3d ago".
 *
 * The backend only returns a report from the last seven days, with its age.
 * Without `report_age_days` (a backend that predates it) this falls back to
 * the report's own date, so an old report still never reads as today's.
 */
export function formatReportAge(
  report: Pick<PlayerStatusData, "report_date" | "report_age_days">
): string | null {
  const age = report.report_age_days;
  if (age != null) {
    if (age <= 0) return "today";
    if (age === 1) return "yesterday";
    return `${age}d ago`;
  }
  const [year, month, day] = report.report_date?.split("-").map(Number) ?? [];
  if (!year || !month || !day || !MONTHS[month - 1]) return null;
  // A day the month does not have ("2026-02-31") is not a date. Day 0 of the next month is this month's last.
  if (day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  // Read the parts directly: new Date("2026-04-12") is UTC midnight, the 11th in the US.
  // The year stays in: last September's report must not read as this September's.
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}
