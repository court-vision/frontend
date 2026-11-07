/**
 * Dime's check-ins, in words (backend services/ai/checkins.py; the Dime
 * autopilot plan, step 3). A check-in is a turn Dime starts itself on a team it
 * runs on, in shadow: it reads what the automations will do, logs every call it
 * makes (holds included), and sends nothing. The AI desk lists them beside the
 * chats; the user marks each call agree or disagree.
 */
import type { AiCheckin, AiCheckinKind, AiCheckinState, AiConversation, AiDecisionBlock, AiVerdict } from "@/types/ai";

export const KIND_LABEL: Record<AiCheckinKind, string> = {
  morning: "Morning",
  weekly: "Weekly",
  pre_lock: "Pre-lock",
  night: "Night follow-up",
};

/** What each kind does, for the Run menu's titles. */
export const KIND_HELP: Record<AiCheckinKind, string> = {
  morning: "Today's plan: what each automation will do, and any move none of them makes",
  weekly: "The morning check-in plus the week's preview and last week's retro",
  pre_lock: "The lineup after the fill, before the first tip",
  night: "How yesterday's calls went, and what that teaches",
};

export const STATE_LABEL: Record<AiCheckinState, string> = {
  running: "Running",
  done: "Done",
  failed: "Failed",
  missed: "Missed",
  skipped: "Skipped",
};

/** Why a check-in didn't run (or didn't finish), in a few words. */
const REASONS: Record<string, string> = {
  window_closed: "its window closed before it could run",
  budget: "this month's check-in budget is used up",
  daily_cap: "the team had its check-ins for the day",
  stale: "it stopped partway (a restart)",
  start_failed: "it couldn't start",
  AI_TIMEOUT: "it took too long",
  AI_INCOMPLETE: "the answer was cut off",
  AI_BUSY: "the model was busy",
};

export function reasonWords(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return REASONS[reason] ?? reason.replace(/_/g, " ").toLowerCase();
}

/** The row's second line: "3 calls · 1 change · 1 sent by Dime · 2 agree · $0.41", or why it didn't run. */
export function checkinLine(c: AiCheckin): string {
  if (c.state === "missed" || c.state === "skipped") {
    return `${STATE_LABEL[c.state]}: ${reasonWords(c.reason) ?? "it didn't run"}`;
  }
  if (c.state === "running") return "Running…";
  const parts: string[] = [];
  if (c.state === "failed") parts.push(`Failed${c.reason ? `: ${reasonWords(c.reason)}` : ""}`);
  parts.push(`${c.decisions} ${c.decisions === 1 ? "call" : "calls"}`);
  if (c.changes) parts.push(`${c.changes} ${c.changes === 1 ? "change" : "changes"}`);
  if (c.sent) parts.push(`${c.sent} sent by Dime`);
  const rated = c.agree + c.disagree;
  if (rated) parts.push(c.disagree ? `${c.agree} agree, ${c.disagree} disagree` : `${c.agree} agree`);
  else if (c.decisions) parts.push("not rated");
  if (c.cost_usd > 0) parts.push(c.cost_usd < 0.01 ? "<$0.01" : `$${c.cost_usd.toFixed(2)}`);
  return parts.join(" · ");
}

/** How many of a list's calls the user agreed with, of those they rated. */
export function agreement(checkins: readonly AiCheckin[]): { agree: number; rated: number } {
  let agree = 0;
  let rated = 0;
  for (const c of checkins) {
    agree += c.agree;
    rated += c.agree + c.disagree;
  }
  return { agree, rated };
}

/** The calls in finished check-ins the user hasn't marked yet. */
export function unrated(checkins: readonly AiCheckin[]): number {
  let n = 0;
  for (const c of checkins) {
    if (c.state === "done" || c.state === "failed") n += Math.max(0, c.decisions - c.agree - c.disagree);
  }
  return n;
}

export const AREA_LABEL: Record<AiDecisionBlock["area"], string> = {
  lineup: "Lineup",
  streaming: "Streaming",
  adds_drops: "Adds and drops",
  other: "Other",
};

export const AUTOMATION_LABEL: Record<AiDecisionBlock["automation"], string | null> = {
  auto_lineup: "auto-lineup's fill",
  stream_lane: "a stream lane",
  scheduled_pickup: "a scheduled pickup",
  none: null,
};

/** The decision's kicker: "Lineup · auto-lineup's fill", or just the area for a move no automation makes. */
export function decisionKicker(d: Pick<AiDecisionBlock, "area" | "automation">): string {
  const whose = AUTOMATION_LABEL[d.automation];
  return whose ? `${AREA_LABEL[d.area]} · ${whose}` : AREA_LABEL[d.area];
}

type Part = AiConversation["history"][number]["parts"][number];

function isDecision(p: Part, decisionId: number): p is Extract<Part, { kind: "block" }> {
  return p.kind === "block" && p.block.type === "decision" && (p.block as AiDecisionBlock).decision_id === decisionId;
}

/** One decision's verdict in a conversation: null unrated, undefined when the call isn't there. */
export function verdictOf(c: AiConversation, decisionId: number): AiVerdict | null | undefined {
  for (const t of c.history) {
    for (const p of t.parts) {
      if (isDecision(p, decisionId)) return (p.block as AiDecisionBlock).verdict ?? null;
    }
  }
  return undefined;
}

/**
 * The verdict saves in flight. A save that fails puts its call back only while it is still the
 * newest save on that call, so Agree then Disagree, with Agree failing last, keeps Disagree. When
 * the last save ends, the stored conversation is read again to settle what was kept.
 */
export class VerdictSaves {
  private newest = new Map<number, number>();
  private count = 0;
  private inFlight = 0;

  /** A save on `decisionId` starts: its number, for `isNewest`. */
  start(decisionId: number): number {
    this.count += 1;
    this.inFlight += 1;
    this.newest.set(decisionId, this.count);
    return this.count;
  }

  isNewest(decisionId: number, save: number): boolean {
    return this.newest.get(decisionId) === save;
  }

  /** A save ended, saved or not: true once none is left in flight. */
  settle(): boolean {
    this.inFlight = Math.max(0, this.inFlight - 1);
    if (this.inFlight === 0) this.newest.clear();
    return this.inFlight === 0;
  }
}

/** The conversation with one decision's verdict set, every other part as it was. */
export function withVerdict(c: AiConversation, decisionId: number, verdict: AiVerdict | null): AiConversation {
  return {
    ...c,
    history: c.history.map((t) => ({
      ...t,
      parts: t.parts.map((p) => (isDecision(p, decisionId) ? { ...p, block: { ...p.block, verdict } } : p)),
    })),
  };
}
