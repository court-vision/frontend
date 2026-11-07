/**
 * Dime's steering (the Dime autopilot plan, step 4): the chips that change what
 * Court Vision's automations do rather than the roster, and the holds they set.
 *
 * - A `steer` chip sets holds and clears them. A hold is one player over a run of
 *   days with Dime's reason: keep (a lane holding his spot keeps him, and Dime
 *   won't drop him), block (no lane adds him, nor Dime), override (his value
 *   those days as a share of his usual one; 0 when Dime expects him to miss, so
 *   auto-lineup's fill treats him as out) or pin (auto-lineup's fill leaves him in
 *   his slot). Holds steer the automations only: the user's own moves are never
 *   refused for one.
 * - A `lane` chip starts, pauses, resumes or stops a stream lane.
 * - A `cancel_pickup` chip cancels a pending scheduled pickup.
 *
 * These change no ESPN roster, so they never go in the tray: the chip's Apply
 * calls the Week desk's own route for it with `proposal_id` (the holds route, the
 * lane routes, the pickup's cancel), which checks the chip and marks it sent.
 * The pure pieces the chip, the hook and the Week desk's hold rows share.
 */
import type { AiHoldChange, AiProposalChip, AiProposalKind } from "@/types/ai";
import type { TeamHold, TeamHoldKind } from "@/types/team-hold";

export const STEERING_KINDS: ReadonlySet<AiProposalKind> = new Set<AiProposalKind>(["steer", "lane", "cancel_pickup"]);

/** A chip that steers an automation (applied with a button) rather than a move sent from the tray. */
export function isSteering(chip: Pick<AiProposalChip, "kind">): boolean {
  return STEERING_KINDS.has(chip.kind);
}

/** "2026-11-06" → "Fri 11/6" (the date alone, no time zone). */
export function shortDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return `${dow} ${m}/${d}`;
}

/** "Fri 11/6", or "Fri 11/6 to Sun 11/8". */
export function daySpan(startsOn: string, endsOn: string): string {
  return startsOn === endsOn ? shortDay(startsOn) : `${shortDay(startsOn)} to ${shortDay(endsOn)}`;
}

/** A hold's kind as its tag: KEEP, BLOCK, PIN, OUT, or the override's share ("50%"). */
export function holdTag(kind: TeamHoldKind, share: number | null | undefined): string {
  if (kind === "override") return share != null && share <= 0 ? "OUT" : `${Math.round((share ?? 0) * 100)}%`;
  return kind.toUpperCase();
}

/** What a hold does, as a verb phrase for a chip's line ("Keep", "Count out", "Count at 50%"). */
export function holdVerb(kind: TeamHoldKind, share: number | null | undefined): string {
  if (kind === "keep") return "Keep";
  if (kind === "block") return "Don't add";
  if (kind === "pin") return "Pin";
  return share != null && share <= 0 ? "Count out" : `Count at ${Math.round((share ?? 0) * 100)}%`;
}

/** One line of a steer chip: what a hold it sets does, to whom, on which days. */
export function holdLine(h: Pick<AiHoldChange, "kind" | "share" | "player" | "starts_on" | "ends_on">): string {
  return `${holdVerb(h.kind, h.share)} ${h.player.name} · ${daySpan(h.starts_on, h.ends_on)}`;
}

/** The button that applies a steering chip, in words. */
export function applyLabel(chip: Pick<AiProposalChip, "kind" | "lane" | "steer">): string {
  if (chip.kind === "cancel_pickup") return "Cancel the pickup";
  if (chip.kind === "lane") {
    const op = chip.lane?.op;
    return op === "start" ? "Start the lane" : op === "pause" ? "Pause the lane" : op === "resume" ? "Resume the lane" : "Stop the lane";
  }
  const sets = chip.steer?.holds.length ?? 0;
  const clears = chip.steer?.clear.length ?? 0;
  if (sets === 0) return clears === 1 ? "Clear the hold" : "Clear the holds";
  return sets === 1 && clears === 0 ? "Set the hold" : "Apply the holds";
}

/** What applying a steering chip does, in the chip's head. */
export function steerHow(chip: Pick<AiProposalChip, "kind">): string {
  return chip.kind === "steer"
    ? "holds: steer auto-lineup and the lanes when you apply them"
    : chip.kind === "lane"
      ? "stream lane: changed when you apply it"
      : "scheduled pickup: cancelled when you apply it";
}

/** The chip's state label once it isn't proposed: a steering chip is applied, not sent. */
export function doneLabel(chip: Pick<AiProposalChip, "kind">): string {
  return isSteering(chip) ? "Applied" : "Sent";
}

/** The holds in force on `date` (ISO), in the order the server lists them (by first day). */
export function holdsOn(holds: readonly TeamHold[], date: string): TeamHold[] {
  return holds.filter((h) => h.starts_on <= date && date <= h.ends_on);
}

/** Which of `dates` (ISO, a week's days) a hold covers, by index. */
export function holdDays(hold: Pick<TeamHold, "starts_on" | "ends_on">, dates: readonly string[]): number[] {
  return dates.flatMap((d, i) => (hold.starts_on <= d && d <= hold.ends_on ? [i] : []));
}
