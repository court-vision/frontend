/**
 * A team's automations, in words and as the server reads them (backend
 * services/ai/autonomy.py and services/ai/levels.py; the Dime autopilot plan's
 * "Automation levels", step 5).
 *
 * Each automation has one level: off, notify (an email says what is due), act
 * (Court Vision does it, no AI) or ai (Dime does it: it reviews the plan, acts
 * within the limits, and logs every call and move). Below AI a level lives with
 * its automation: lineup's are the notification preferences (the tip-off email
 * and auto-lineup), lanes run as you set them. AI and the autopilot switch are
 * per team, only on teams Dime runs on; the switch puts every row that offers AI
 * at AI. Dime sends a move itself only on rows at AI, with check-ins on and
 * acting on on the server; anywhere else a check-in's change is a review.
 */
import type {
  AiActing,
  AiActingPolicy,
  AiActionOutcome,
  AiAutomationName,
  AiAutomationRow,
  AiAutopilotTeam,
  AiConversation,
  AiDecisionAction,
  AiLevel,
  AiLevelOption,
} from "@/types/ai";
import type { NotificationPreference } from "@/types/notifications";

export const LEVELS: readonly AiLevel[] = ["off", "notify", "act", "ai"];
/** The account's table: AI is per team, in the Dime block. */
export const ACCOUNT_LEVELS: readonly AiLevel[] = ["off", "notify", "act"];

export const LEVEL_LABEL: Record<AiLevel, string> = { off: "Off", notify: "Notify", act: "Act", ai: "AI" };

export const LEVEL_HELP: Record<AiLevel, string> = {
  off: "Nothing runs",
  notify: "An email says what is due",
  act: "Court Vision does it, no AI",
  ai: "Dime does it: it reviews the plan, acts within the limits and logs every call",
};

/** Every row the server's table has, in its order; the first four can be at AI. */
export const ROWS: readonly AiAutomationName[] = ["lineup", "daily_actions", "lanes", "late_scratch", "checkins"];
export const AI_ROWS: readonly AiAutomationName[] = ["lineup", "daily_actions", "lanes", "late_scratch"];

export const ROW_LABEL: Record<AiAutomationName, string> = {
  lineup: "Lineup",
  daily_actions: "Daily actions",
  lanes: "Stream lanes",
  late_scratch: "Late scratches and news",
  checkins: "Check-ins",
};

export const ROW_HELP: Record<AiAutomationName, string> = {
  lineup: "Each day's slots. Notify is the tip-off email, Act is auto-lineup's fill; at AI Dime reviews the fill before lock and moves slots or pins players",
  daily_actions: "The Week desk's IR moves and the day's pickup and drop; at AI Dime makes its own adds and drops and may cancel a pickup you scheduled",
  lanes: "Your lanes run as you set them; at AI Dime also starts, pauses, stops and steers them",
  late_scratch: "News and late scratches before a player's game; at AI an event check-in before it locks",
  checkins: "Dime's morning, pre-lock, night and weekly check-ins. AI needs them",
};

/** What a row doesn't offer, and why (the server's NOT_OFFERED); the account's table reads it. */
export const NOT_OFFERED: Partial<Record<AiAutomationName, Partial<Record<AiLevel, string>>>> = {
  daily_actions: {
    notify: "Not built yet: a morning email with the day's list",
    act: "Not built yet: Court Vision making the list's moves",
  },
  lanes: { off: "Lanes are started and stopped one at a time in the Week desk", notify: "Not offered yet" },
  late_scratch: {
    notify: "Not built yet: an email when news touches a player before his game",
    act: "Not built yet: the late-scratch swap",
  },
  checkins: { notify: "Check-ins are Dime's own", act: "Check-ins are Dime's own" },
};

export const EMAIL_OFF = "Your account's lineup email is off, so no team's lineup runs: turn it on in Notifications";

/** A row's note while the autopilot switch holds it at AI (the server's words). */
export const AUTOPILOT_NOTE = "Autopilot sets these";

/** Late scratches at AI while the server's event check-ins are off (the server's words). */
export const EVENTS_OFF = "Nothing starts yet: event check-ins are switched off on the server";

// ---------------------------------------------------------------------------
// Lineup below AI: the tip-off email and auto-lineup
// ---------------------------------------------------------------------------

type LineupPrefs = Pick<NotificationPreference, "lineup_alerts_enabled" | "auto_lineup_enabled">;

/** Lineup's level from the preferences in force: off, notify (the email) or act (the email and the fill). */
export function lineupLevel(p: LineupPrefs): "off" | "notify" | "act" {
  if (!p.lineup_alerts_enabled) return "off";
  return p.auto_lineup_enabled ? "act" : "notify";
}

/** What a lineup level writes to the preferences (AI writes what Act does, and adds Dime). */
export function lineupPrefs(level: AiLevel): LineupPrefs {
  if (level === "off") return { lineup_alerts_enabled: false, auto_lineup_enabled: false };
  if (level === "notify") return { lineup_alerts_enabled: true, auto_lineup_enabled: false };
  return { lineup_alerts_enabled: true, auto_lineup_enabled: true };
}

/** A row's level below AI as the account's table shows it. */
export function belowAi(row: AiAutomationName, prefs: LineupPrefs): AiLevel {
  if (row === "lineup") return lineupLevel(prefs);
  if (row === "lanes") return "act";
  return "off";
}

/**
 * Each level the account's table offers on a row, and why not. `accountEmail` is the
 * account's own lineup email: without it no team's lineup runs, so a team's own
 * Notify and Act can't be picked either.
 */
export function accountOptions(row: AiAutomationName, accountEmail = true): AiLevelOption[] {
  return ACCOUNT_LEVELS.map((level) => {
    let reason = NOT_OFFERED[row]?.[level] ?? null;
    if (reason == null && row === "lineup" && level !== "off" && !accountEmail) reason = EMAIL_OFF;
    return { level, available: reason == null, reason };
  });
}

// ---------------------------------------------------------------------------
// A team's table, as the server builds it (the demo's, and the tests')
// ---------------------------------------------------------------------------

export interface TableState {
  aiRows: AiAutomationName[];
  autopilot: boolean;
  /** Check-ins are off: paused, by the user or by Dime itself. */
  paused: boolean;
  pausedBy?: "user" | "system" | null;
  pausedReason?: string | null;
  lineupBelowAi: AiLevel;
  lineupEmail: boolean;
  actingAvailable: boolean;
  /** The server starts event check-ins (DIME_EVENTS_ENABLED); left out, it does. */
  eventsAvailable?: boolean;
}

export function offersAi(row: AiAutomationName): boolean {
  return AI_ROWS.includes(row) && NOT_OFFERED[row]?.ai == null;
}

/** The row is at AI: the switch is on, or the user put it there (and it offers AI). */
export function atAi(t: Pick<TableState, "aiRows" | "autopilot">, row: AiAutomationName): boolean {
  return offersAi(row) && (t.autopilot || t.aiRows.includes(row));
}

/** The server's autonomy.table: every row's level, each level's availability and why not, and its note. */
export function tableOf(t: TableState): AiAutomationRow[] {
  return ROWS.map((row) => {
    let level: AiLevel;
    if (row === "checkins") level = t.paused ? "off" : "ai";
    else if (atAi(t, row)) level = "ai";
    else if (row === "lineup") level = t.lineupBelowAi;
    else level = row === "lanes" ? "act" : "off";
    const options = LEVELS.map((lv) => {
      let reason = NOT_OFFERED[row]?.[lv] ?? null;
      if (reason == null && row === "lineup" && lv !== "off" && !t.lineupEmail) reason = EMAIL_OFF;
      return { level: lv, available: reason == null, reason };
    });
    let note: string | null = null;
    if (row !== "checkins" && level === "ai") {
      if (t.autopilot) note = AUTOPILOT_NOTE;
      if (t.paused) note = "Paused: Dime does nothing here until you resume check-ins";
      else if (row === "late_scratch" && t.eventsAvailable === false) note = EVENTS_OFF;
      else if (!t.actingAvailable) note = "Reviews only: Dime's acting is switched off on the server";
      if (row === "lineup" && !t.lineupEmail) note = `${note ? `${note}. ` : ""}Auto-lineup doesn't run: your account's lineup email is off`;
    }
    if (row === "checkins" && t.paused && t.pausedBy === "system") note = t.pausedReason ? `Dime paused itself: ${t.pausedReason}` : "Dime paused itself";
    return { row, label: ROW_LABEL[row], level, options, note };
  });
}

// ---------------------------------------------------------------------------
// The team's switches, in words
// ---------------------------------------------------------------------------

/** Some row other than check-ins is at AI on the team. */
export function anyAtAi(team: Pick<AiAutopilotTeam, "rows">): boolean {
  return team.rows.some((r) => r.row !== "checkins" && r.level === "ai");
}

/** The rows at AI, in the table's order, as "lineup and daily actions"; null when none. */
export function aiRowsLine(team: Pick<AiAutopilotTeam, "rows">): string | null {
  const names = team.rows.filter((r) => r.row !== "checkins" && r.level === "ai").map((r) => r.label.toLowerCase());
  if (!names.length) return null;
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The Check-ins row's two segments. With something at AI, its Off reads as Pause (and a
 * pause as Paused, with Resume beside it); with nothing at AI, it is plain Off and AI.
 */
export function checkinsLabels(team: Pick<AiAutopilotTeam, "rows" | "on">): { off: string; ai: string } {
  if (!anyAtAi(team)) return { off: "Off", ai: "AI" };
  return team.on ? { off: "Pause", ai: "AI" } : { off: "Paused", ai: "Resume" };
}

/** What Dime does on the team, in a line, for the AI desk's check-ins. */
export function teamLine(team: Pick<AiAutopilotTeam, "rows" | "on" | "autopilot">, acting: Pick<AiActing, "available"> | null): string {
  const rows = aiRowsLine(team);
  if (!rows) return "Dime reviews and logs; nothing is at AI";
  const who = team.autopilot ? "Autopilot: " : "At AI: ";
  if (!team.on) return `${who}${rows}, paused`;
  if (!acting?.available) return `${who}${rows}, reviews only (acting is off on the server)`;
  return `${who}${rows}`;
}

/** The switch's line: why the team is paused, when it is. */
export function pauseLine(t: Pick<AiAutopilotTeam, "paused_at" | "paused_by" | "paused_reason">): string | null {
  if (!t.paused_at) return null;
  if (t.paused_by === "system") return `Dime paused itself${t.paused_reason ? `: ${t.paused_reason}` : ""}`;
  return "Paused";
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The policy every move Dime sends itself is held to, in two sentences. */
export function policyLine(p: AiActingPolicy): string {
  return (
    `On automations at AI Dime makes at most ${count(p.adds_per_day, "add")} a day and ${p.adds_per_matchup} a matchup, ` +
    `leaves ${p.adds_reserve} of the league's adds for you, and never drops one of your top ` +
    `${p.protected_top} or a player added in the last ${p.churn_hours} hours unless he's out. ` +
    `It pauses itself and emails you after ${count(p.pause_refused, "refused move")}, or the same rule stopping it ` +
    `${count(p.pause_same_block, "time")}, in a day.`
  );
}

// ---------------------------------------------------------------------------
// What became of Dime's moves
// ---------------------------------------------------------------------------

export const OUTCOME_LABEL: Record<AiActionOutcome, string> = {
  sent: "Sent by Dime",
  blocked: "Held back",
  refused: "Refused",
  failed: "Didn't go through",
};

/** A move's action as a decision block or Dime's moves shows it: the label and what happened. */
export function actionLine(a: Pick<AiDecisionAction, "outcome" | "message">): { label: string; text: string } {
  const text = a.message
    .replace(/^Already handled: /, "")
    .replace(/^Sent by Dime: /, "")
    .replace(/; left as a chip for the user$/, "");
  return { label: OUTCOME_LABEL[a.outcome], text: a.outcome === "sent" ? text : `${text}. The chip is still yours to send.` };
}

/** A check-in's banner: what Dime sent itself and held back, or that it only reviewed. */
export function checkinBanner(c: Pick<AiConversation, "history">): string {
  let sent = 0;
  let held = 0;
  for (const t of c.history) {
    for (const p of t.parts) {
      if (p.kind !== "block") continue;
      const b = p.block;
      if (b.type === "decision" && b.action) {
        if (b.action.outcome === "sent") sent += 1;
        else held += 1;
      }
    }
  }
  const rate = "Mark each call agree or disagree; a follow-up here is an ordinary chat.";
  if (sent || held) {
    const did = sent ? `Dime sent ${count(sent, "move")} itself` : "Dime sent nothing itself";
    const rest = held ? `; ${count(held, "move")} it held back ${held === 1 ? "is a chip" : "are chips"} you can send` : "";
    return `${did}${rest}. ${rate}`;
  }
  return `A review: nothing in this check-in was sent to ESPN. ${rate}`;
}

// ---------------------------------------------------------------------------
// Dime's moves (the AI desk's ?v=moves)
// ---------------------------------------------------------------------------

/** The rule that stopped a move, as its chip names it (backend services/ai/acting.py, `rule`). */
export const RULE_LABEL: Record<string, string> = {
  ai_off: "Not at AI",
  autopilot_off: "Not at AI",
  paused: "Paused",
  not_allowed: "Not allowed",
  writes_off: "Roster writes off",
  steering_off: "Steering off",
  expired: "Too late",
  cap_day: "Day's adds used",
  cap_matchup: "Matchup's adds used",
  reserve: "Adds kept for you",
  protected: "Top player",
  churn: "Added recently",
  credentials: "ESPN sign-in",
  espn_rejected: "ESPN said no",
  error: "Error",
};

/** A rule's chip; an error code the server passed through reads as itself, in words. */
export function ruleLabel(rule: string | null | undefined): string | null {
  if (!rule) return null;
  return RULE_LABEL[rule] ?? rule.replace(/^AI_/, "").replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

/** What kind of move it was (a proposal's kind). */
export const MOVE_KIND_LABEL: Record<string, string> = {
  transaction: "Add and drop",
  scheduled: "Scheduled pickup",
  lineup: "Lineup",
  steer: "Holds",
  lane: "Stream lane",
  cancel_pickup: "Pickup cancelled",
};

export type MovesFilter = "all" | "sent" | "held";

/** Dime's moves, filtered: everything, what it sent itself, or what it held back (anything not sent). */
export function movesOf<T extends { outcome: string }>(moves: readonly T[], filter: MovesFilter): T[] {
  if (filter === "all") return [...moves];
  return moves.filter((m) => (filter === "sent" ? m.outcome === "sent" : m.outcome !== "sent"));
}
