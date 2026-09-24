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
  const [, month, day] = report.report_date?.split("-").map(Number) ?? [];
  if (!month || !day || !MONTHS[month - 1]) return null;
  // Read the parts directly: new Date("2026-04-12") is UTC midnight, the 11th in the US.
  return `${MONTHS[month - 1]} ${day}`;
}
