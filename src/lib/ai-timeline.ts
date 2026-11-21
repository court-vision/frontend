/**
 * The AI desk's timeline, in words and order (backend services/ai/timeline.py; the Dime desk
 * redesign, step 1). A team's fantasy day (ESPN's, turning at 3 AM ET) top to bottom: the
 * check-ins that ran, a Now line on today, the check-ins still to come and the first tip. Each
 * check-in says what Dime thought (its calls), what it did (sent or held back) and what it noted.
 */
import { anyAtAi, pauseLine } from "@/lib/ai-autonomy";
import { KIND_LABEL, reasonWords, STATE_LABEL } from "@/lib/ai-checkins";
import { windowOf, windowResult, type Tone } from "@/lib/dime";
import type { AiAutopilotTeam, AiCheckinKind, AiCheckinSlot, AiNote, AiTimeline, AiTimelineCall, AiTimelineCheckin, MoveWindowName } from "@/types/ai";

export type TimelineRow =
  | { kind: "checkin"; at: number; checkin: AiTimelineCheckin }
  | { kind: "now"; at: number }
  | { kind: "upcoming"; at: number; slot: AiCheckinSlot }
  | { kind: "tip"; at: number };

const RANK: Record<TimelineRow["kind"], number> = { checkin: 0, now: 1, upcoming: 2, tip: 3 };

/** The day's rows in the order they happen; the Now line only on the day it is now. */
export function timelineRows(d: Pick<AiTimeline, "checkins" | "upcoming" | "first_tip" | "starts_at" | "ends_at">, now: number): TimelineRow[] {
  const rows: TimelineRow[] = [
    ...d.checkins.map((c) => ({ kind: "checkin" as const, at: Date.parse(c.started_at), checkin: c })),
    ...d.upcoming.map((slot) => ({ kind: "upcoming" as const, at: Date.parse(slot.due_at), slot })),
  ];
  if (d.first_tip) rows.push({ kind: "tip", at: Date.parse(d.first_tip) });
  if (now >= Date.parse(d.starts_at) && now < Date.parse(d.ends_at)) rows.push({ kind: "now", at: now });
  return rows.sort((a, b) => a.at - b.at || RANK[a.kind] - RANK[b.kind]);
}

/** A YYYY-MM-DD day `n` days on. */
export function shiftDay(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Fri 11/20" for a YYYY-MM-DD day. */
export function shortDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${m}/${d}`;
}

/** The day switcher's label: "Today · Fri 11/20", "Yesterday · Thu 11/19", or just "Wed 11/18". */
export function dayLabel(day: string, today: string): string {
  const near = day === today ? "Today" : day === shiftDay(today, -1) ? "Yesterday" : day === shiftDay(today, 1) ? "Tomorrow" : null;
  return near ? `${near} · ${shortDay(day)}` : shortDay(day);
}

export const KIND_LETTER: Record<AiCheckinKind, string> = { morning: "M", weekly: "W", pre_lock: "P", night: "N", event: "E" };

/** What a scheduled slot does, for its row on the timeline. */
export const SLOT_NOTE: Record<AiCheckinKind, string> = {
  morning: "Today's plan: what each automation will do",
  weekly: "The week's preview and last week's retro",
  pre_lock: "The lineup after the fill, before the first tip",
  night: "How yesterday's calls went",
  event: "News about a rostered player",
};

/** The check-in's title on the timeline: "Night follow-up", with what day it is about when that isn't the day it ran. */
export function checkinTitle(c: Pick<AiTimelineCheckin, "kind" | "date">, day: string): { title: string; about: string | null } {
  return { title: KIND_LABEL[c.kind], about: c.date !== day ? `about ${shortDay(c.date).split(" ")[0]}` : null };
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * What the check-in did, in a chip: "Sent 1 move", "Held back 1", "A review" (changes it would
 * make on rows below AI, sent to nobody), "No changes"; or why it didn't run.
 */
export function didChip(c: AiTimelineCheckin): { text: string; tone: Tone | "warn" | "pv" } {
  if (c.state === "running") return { text: "Thinking…", tone: "pv" };
  if (c.state === "missed" || c.state === "skipped") return { text: STATE_LABEL[c.state], tone: "warn" };
  if (c.state === "failed" && c.calls.length === 0) return { text: "Failed", tone: "down" };
  const sent = c.calls.filter((x) => x.action?.outcome === "sent").length;
  const held = c.calls.filter((x) => x.action && x.action.outcome !== "sent").length;
  const reviews = c.calls.filter((x) => x.call === "change" && !x.action).length;
  if (sent) return { text: `Sent ${count(sent, "move")}${held ? `, held ${held}` : ""}`, tone: "up" };
  if (held) return { text: `Held back ${held}`, tone: "warn" };
  if (reviews) return { text: reviews === 1 ? "A review" : `${reviews} reviews`, tone: "flat" };
  return { text: "No changes", tone: "flat" };
}

/** Why a check-in has nothing to show: missed, skipped or failed, with the reason. */
export function stateLine(c: Pick<AiTimelineCheckin, "state" | "reason">): string | null {
  if (c.state !== "missed" && c.state !== "skipped" && c.state !== "failed") return null;
  const why = reasonWords(c.reason);
  return why ? `${STATE_LABEL[c.state]}: ${why}` : STATE_LABEL[c.state];
}

/** How a move Dime sent went: the matchup's result once there is one, else the day's; null before the ledger has it. */
export function callResult(call: Pick<AiTimelineCall, "result">): { text: string; tone: Tone; window: MoveWindowName; open: boolean } | null {
  if (!call.result) return null;
  for (const name of ["matchup", "day"] as const) {
    const w = windowOf(call.result, name);
    const r = windowResult(w);
    if (w && r) return { ...r, window: name, open: !w.complete };
  }
  return null;
}

/** The team's plan: its newest live plan note, for the strip on top of the timeline. */
export function planNote(notes: readonly AiNote[] | undefined, teamId: number | null): AiNote | null {
  if (!notes || teamId == null) return null;
  const plans = notes.filter((n) => n.kind === "plan" && n.team_id === teamId && n.retired_on == null);
  return plans.sort((a, b) => (a.written_on < b.written_on ? 1 : a.written_on > b.written_on ? -1 : b.note_id - a.note_id))[0] ?? null;
}

/**
 * The team's day has a timeline: its check-ins run, or are paused over automations at AI (event
 * check-ins can still come in). With check-ins off and nothing at AI the desk is the chat alone.
 */
export function showsTimeline(team: Pick<AiAutopilotTeam, "on" | "rows" | "paused_at"> | null | undefined): boolean {
  return !!team && (team.on || !!team.paused_at || anyAtAi(team));
}

/** Why no check-in is scheduled on a team that has a timeline: "Paused", or Dime's own reason. Null while they run. */
export function pausedLine(team: Pick<AiAutopilotTeam, "on" | "paused_at" | "paused_by" | "paused_reason"> | null | undefined): string | null {
  if (!team || team.on) return null;
  return pauseLine(team) ?? "Check-ins are paused";
}
