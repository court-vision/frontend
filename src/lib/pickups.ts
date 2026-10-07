/**
 * Scheduled pickups as the week desk lays them out: which day of the week each
 * lands on, what became of it in words, and when the server makes one.
 *
 * The server's timing rule (backend `attempt_window`): a pickup for ESPN day D
 * is first tried at D-1's first tip-off, after which an acquisition counts for
 * D; when the player to drop plays on D-1 it waits for the rollover into D, so
 * his game still counts. D's own first tip-off is the deadline.
 */
import type { ScheduledPickup, ScheduledPickupList } from "@/types/scheduled-pickup";
import { SCHEDULED_PICKUP_NOT_PENDING, dataString, toApiError, userMessage } from "./api-error";
import type { SourcePlayer, WeekDay } from "./week-grid";

export interface PickupView {
  id: number;
  status: ScheduledPickup["status"];
  /** Its day in this week; null when it falls in another week. */
  day: number | null;
  /** The NBA date it is for. */
  date: string;
  add: ScheduledPickup["add"];
  drop: ScheduledPickup["drop"];
  /** Why it is waiting, or how it settled, in words. */
  note: string | null;
  /** When a pending one is first tried (ISO). */
  notBefore: string;
}

/** Pending pickups (soonest first), then the ones settled for a day of this week. Cancelled ones are left out. */
export function pickupViews(list: ScheduledPickupList, days: ReadonlyArray<WeekDay>): PickupView[] {
  const dayOf = (date: string) => days.find((d) => d.date === date)?.index ?? null;
  const settled = list.recent.filter((p) => p.status !== "cancelled" && dayOf(p.nba_date) != null);
  return [...list.pending, ...settled].map((p) => ({
    id: p.id,
    status: p.status,
    day: dayOf(p.nba_date),
    date: p.nba_date,
    add: p.add,
    drop: p.drop ?? null,
    note: pickupNote(p),
    notBefore: p.not_before_at,
  }));
}

const REASONS: Record<string, string> = {
  add_on_waivers: "he's on waivers",
  add_locked: "his game has started",
  drop_locked: "the player to drop was locked",
  drop_missing: "the player to drop had already left the roster",
  already_on_roster: "he was already on your roster",
  unavailable: "he was no longer available",
  roster_full: "your roster was full",
  locked_on_day: "his game had started",
  deadline: "that day's games started first",
  max_attempts: "too many tries",
  auth_expired: "your ESPN connection expired",
  writer_unavailable: "ESPN couldn't be reached",
  provider_error: "ESPN couldn't be reached",
  writes_disabled: "roster changes are paused",
  espn_rejected: "ESPN refused it",
  period_lag: "ESPN hasn't rolled over to the next day yet",
  holder_plays_today: "the player to drop plays first",
  unverified: "ESPN hasn't confirmed it yet",
  team_not_found: "the team is no longer connected",
};

const words = (reason: string) => REASONS[reason] ?? reason.replace(/_/g, " ");

/** A pickup's state in words: why it waits, or what became of it. */
export function pickupNote(p: Pick<ScheduledPickup, "status" | "reason" | "seated_slot" | "detail">): string | null {
  switch (p.status) {
    case "pending":
      return p.reason ? `Waiting: ${words(p.reason)}` : null;
    case "executed":
      return p.seated_slot ? `Added, starting at ${p.seated_slot}` : "Added, on the bench";
    case "skipped":
      return `Skipped: ${p.reason ? words(p.reason) : "nothing to do"}`;
    case "failed":
      return `Failed: ${p.detail || (p.reason ? words(p.reason) : "ESPN refused it")}`;
    case "expired":
      return `Expired: ${p.reason ? words(p.reason) : "that day's games started first"}`;
    case "cancelled":
      return "Cancelled";
  }
}

/**
 * When a pickup for `day` would be made, in words. `drop` is the player it
 * drops (his games say whether he plays the day before); `addFrom` is the
 * first day an add made now counts (set once today's first tip has passed).
 */
export function pickupTiming(
  days: ReadonlyArray<WeekDay>,
  day: number,
  drop: Pick<SourcePlayer, "name" | "games"> | null,
  todayIndex: number | null,
  addFrom: number | null
): string {
  const d = days[day];
  const prev = days[day - 1];
  if (!d) return "";
  if (!prev) return `Made before ${d.dow}'s first game`;
  if (drop && drop.games[prev.index] != null) {
    return `Made overnight into ${d.dow}, after ${lastName(drop.name)} plays ${prev.dow}`;
  }
  if (prev.index === todayIndex && addFrom === day) return `Made right away: today's games have started`;
  return `Made at ${prev.dow}'s first tip-off`;
}

const lastName = (name: string) => name.split(" ").slice(1).join(" ") || name;

/**
 * What a refused cancel tells the user. The pickup is never taken off the list
 * for one: the list is read again and shows it as the server has it. A pickup
 * that settled first (409 NOT_PENDING, its status in `data`) is an error only
 * if it ran; any other refusal, such as a pickup being made right now, is an
 * error in the server's words.
 */
export function cancelRefusal(error: unknown): { tone: "error" | "info"; message: string } {
  const err = toApiError(error);
  if (err.code !== SCHEDULED_PICKUP_NOT_PENDING) {
    return { tone: "error", message: userMessage(err, "Couldn't cancel that pickup") };
  }
  switch (dataString(err, "status")) {
    case "executed":
      return { tone: "error", message: "Too late to cancel: that pickup already ran" };
    case "cancelled":
      return { tone: "info", message: "That pickup was already cancelled" };
    default:
      // Skipped, failed or expired: it never ran, and the list now says why.
      return { tone: "info", message: userMessage(err, "That pickup is no longer pending") };
  }
}
