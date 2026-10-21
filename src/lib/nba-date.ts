/** Before this hour (Eastern) it is still the previous night's game date. */
export const DAY_ROLLOVER_HOUR_ET = 6;

/**
 * Today's NBA game date (YYYY-MM-DD), on the backend's rule (cv-core's
 * `nba_date_et`): the night a game belongs to, so before 6 AM ET it is still
 * last night. A West-coast game running past midnight stays tonight's, and the
 * live endpoints, which answer for that date until 6 AM, agree with the desks.
 */
export function getTodayDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const day = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  if (part("hour") < DAY_ROLLOVER_HOUR_ET) day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}
