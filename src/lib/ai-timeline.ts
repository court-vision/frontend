/**
 * The AI desk's timeline, in words and order (backend services/ai/timeline.py; the Dime desk
 * redesign, step 1). A team's fantasy day (ESPN's, turning at 3 AM ET) top to bottom: the
 * check-ins that ran, a Now line on today, the check-ins still to come and the first tip. Each
 * check-in says what Dime thought (its calls), what it did (sent or held back) and what it noted.
 * The user's asks (step 2) sit at their time: "You asked" while they wait, then the check-in that
 * ran them.
 */
import { anyAtAi, pauseLine } from "@/lib/ai-autonomy";
import { KIND_LABEL, reasonWords, STATE_LABEL } from "@/lib/ai-checkins";
import { windowOf, windowResult, type Tone } from "@/lib/dime";
import type {
  AiAsk,
  AiAutopilotTeam,
  AiCheckinKind,
  AiCheckinSlot,
  AiNote,
  AiTimeline,
  AiTimelineCall,
  AiTimelineCheckin,
  AiVerdict,
  MoveWindowName,
} from "@/types/ai";

export type TimelineRow =
  | { kind: "checkin"; at: number; checkin: AiTimelineCheckin }
  | { kind: "now"; at: number }
  | { kind: "ask"; at: number; ask: AiAsk }
  | { kind: "upcoming"; at: number; slot: AiCheckinSlot }
  | { kind: "tip"; at: number };

const RANK: Record<TimelineRow["kind"], number> = { checkin: 0, now: 1, ask: 2, upcoming: 3, tip: 4 };

/** The day's rows in the order they happen; the Now line only on the day it is now. */
export function timelineRows(
  d: Pick<AiTimeline, "checkins" | "upcoming" | "first_tip" | "starts_at" | "ends_at"> & { asks?: AiAsk[] },
  now: number
): TimelineRow[] {
  const rows: TimelineRow[] = [
    ...d.checkins.map((c) => ({ kind: "checkin" as const, at: Date.parse(c.started_at), checkin: c })),
    ...(d.asks ?? []).map((ask) => ({ kind: "ask" as const, at: Date.parse(ask.due_at), ask })),
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

export const KIND_LETTER: Record<AiCheckinKind, string> = { morning: "M", weekly: "W", pre_lock: "P", night: "N", event: "E", ask: "A" };

/** What a scheduled slot does, for its row on the timeline. */
export const SLOT_NOTE: Record<AiCheckinKind, string> = {
  morning: "Today's plan: what each automation will do",
  weekly: "The week's preview and last week's retro",
  pre_lock: "The lineup after the fill, before the first tip",
  night: "How yesterday's calls went",
  event: "News about a rostered player",
  ask: "Something you asked Dime to do",
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
  // An ask's changes below AI are live chips waiting in its conversation, not reviews
  if (reviews && c.kind === "ask") return { text: `Left ${reviews} for you`, tone: "pv" };
  if (reviews) return { text: reviews === 1 ? "A review" : `${reviews} reviews`, tone: "flat" };
  return { text: "No changes", tone: "flat" };
}

/** A change of a check-in that wasn't sent, in words: a review, or in an ask a chip the user sends. */
export function unsentLine(kind: AiCheckinKind): string {
  return kind === "ask"
    ? "Left for you to send: it's a chip in the conversation. Its row isn't at AI, so Dime didn't send it."
    : "A review: what Dime would do. Its row isn't at AI, so nothing was sent.";
}

export const ASK_STATE_LABEL: Record<AiAsk["state"], string> = {
  pending: "Waiting",
  running: "Dime is on it",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
  missed: "Missed",
  skipped: "Skipped",
};

/** An ask's state chip: purple while it waits or runs (Dime's own color), quiet once done or cancelled. */
export function askTone(state: AiAsk["state"]): Tone | "warn" | "pv" {
  if (state === "pending" || state === "running") return "pv";
  if (state === "failed") return "down";
  if (state === "missed" || state === "skipped") return "warn";
  return "flat";
}

/** Why an ask closed without running ("Missed: it was still waiting an hour after its time"); null otherwise. */
export function askClosedLine(a: Pick<AiAsk, "state" | "reason">): string | null {
  if (a.state !== "cancelled" && a.state !== "missed" && a.state !== "skipped" && a.state !== "failed") return null;
  if (a.state === "cancelled") return "Cancelled";
  const why = reasonWords(a.reason);
  return why ? `${ASK_STATE_LABEL[a.state]}: ${why}` : ASK_STATE_LABEL[a.state];
}

/** An ask is due within the next few minutes (or just was) or running: what's showing it reads again soon. */
export function askSoon(asks: readonly Pick<AiAsk, "state" | "due_at">[] | null | undefined, now: number): boolean {
  return (asks ?? []).some((a) => {
    if (a.state === "running") return true;
    if (a.state !== "pending") return false;
    const at = Date.parse(a.due_at);
    return at - now < 5 * 60_000 && now - at < 60 * 60_000;
  });
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

/** One call's verdict on a day's timeline: null unrated, undefined when the call isn't on that day. */
export function timelineVerdictOf(t: Pick<AiTimeline, "checkins">, decisionId: number): AiVerdict | null | undefined {
  for (const c of t.checkins) {
    for (const call of c.calls) {
      if (call.decision_id === decisionId) return call.verdict ?? null;
    }
  }
  return undefined;
}

/** The day's timeline with one call's verdict set, every other call as it was. */
export function timelineWithVerdict<T extends Pick<AiTimeline, "checkins">>(t: T, decisionId: number, verdict: AiVerdict | null): T {
  if (timelineVerdictOf(t, decisionId) === undefined) return t;
  return {
    ...t,
    checkins: t.checkins.map((c) =>
      c.calls.some((call) => call.decision_id === decisionId)
        ? { ...c, calls: c.calls.map((call) => (call.decision_id === decisionId ? { ...call, verdict } : call)) }
        : c
    ),
  };
}
