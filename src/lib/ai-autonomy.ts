/**
 * How much Dime may do on a team, in words (backend services/ai/autonomy.py and
 * services/ai/acting.py; the Dime autopilot plan, step 5).
 *
 * Three modes, least to most: shadow (a check-in logs what Dime would change and
 * sends nothing), suggest (its changes become chips you send or apply, as in
 * chat), act (the server sends them itself, within the policy). Three kinds of
 * move: lineup, streaming, adds and drops. A team has one mode, and a kind of
 * move can have its own that stands in for it; whether the settings end up one
 * per team, one per kind or both is still James's call, and these helpers read
 * either shape.
 */
import type {
  AiActingPolicy,
  AiActionOutcome,
  AiAutonomy,
  AiAutonomyMode,
  AiAutopilotTeam,
  AiCapability,
  AiConversation,
  AiDecisionAction,
} from "@/types/ai";

export const MODES: readonly AiAutonomyMode[] = ["shadow", "suggest", "act"];
export const CAPABILITIES: readonly AiCapability[] = ["lineup", "streaming", "adds_drops"];

export const MODE_LABEL: Record<AiAutonomyMode, string> = { shadow: "Shadow", suggest: "Suggest", act: "Act" };

export const MODE_HELP: Record<AiAutonomyMode, string> = {
  shadow: "Dime logs what it would change and sends nothing",
  suggest: "Dime's changes become chips you send or apply, as in chat",
  act: "Dime sends its changes itself, within the limits below",
};

export const CAPABILITY_LABEL: Record<AiCapability, string> = {
  lineup: "Lineup",
  streaming: "Streaming",
  adds_drops: "Adds and drops",
};

export const CAPABILITY_HELP: Record<AiCapability, string> = {
  lineup: "Slot moves, and pins on auto-lineup's fill",
  streaming: "Stream lanes (start, pause, stop) and the holds that steer their plans",
  adds_drops: "Dime's own adds and drops, and cancelling a pickup you scheduled",
};

/** The mode set for a kind of move: its own, or the team's. */
export function modeOf(a: AiAutonomy, c: AiCapability): AiAutonomyMode {
  return a.own[c] ?? a.mode;
}

/**
 * What each kind may do now, as the server reads it (autonomy.effective): its own mode or the
 * team's, act read as suggest while acting is switched off, every kind in shadow while paused.
 */
export function effectiveOf(
  mode: AiAutonomyMode,
  own: AiAutonomy["own"],
  paused: boolean,
  canAct: boolean
): AiAutonomy["effective"] {
  const one = (c: AiCapability): AiAutonomyMode => {
    if (paused) return "shadow";
    const set = own[c] ?? mode;
    return set === "act" && !canAct ? "suggest" : set;
  };
  return { lineup: one("lineup"), streaming: one("streaming"), adds_drops: one("adds_drops") };
}

/** The settings in a line: "Shadow", or "Suggest · adds and drops act" when a kind differs from the team. */
export function autonomyLine(a: AiAutonomy): string {
  const differ = CAPABILITIES.filter((c) => modeOf(a, c) !== a.mode);
  if (!differ.length) return MODE_LABEL[a.mode];
  return `${MODE_LABEL[a.mode]} · ${differ.map((c) => `${CAPABILITY_LABEL[c].toLowerCase()} ${modeOf(a, c)}`).join(", ")}`;
}

/** Why a kind does less than it is set to now; null when it does what it says. */
export function heldBack(a: AiAutonomy, c: AiCapability, paused: boolean): string | null {
  const set = modeOf(a, c);
  if (set === "shadow") return null;
  if (paused) return "Paused, so in shadow until you resume it";
  if (set === "act" && a.effective[c] === "suggest") return "Suggests until acting is switched on";
  return null;
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
    `When Dime acts it makes at most ${count(p.adds_per_day, "add")} a day and ${p.adds_per_matchup} a matchup, ` +
    `leaves ${p.adds_reserve} of the league's adds for you, and never drops one of your top ` +
    `${p.protected_top} or a player added in the last ${p.churn_hours} hours unless he's out. ` +
    `It pauses itself and emails you after ${count(p.pause_refused, "refused move")}, or the same rule stopping it ` +
    `${count(p.pause_same_block, "time")}, in a day.`
  );
}

export const OUTCOME_LABEL: Record<AiActionOutcome, string> = {
  sent: "Sent by Dime",
  blocked: "Held back",
  refused: "Refused",
  failed: "Didn't go through",
};

/** A decision's action as its block shows it: the label and what happened. */
export function actionLine(a: Pick<AiDecisionAction, "outcome" | "message">): { label: string; text: string } {
  const text = a.message
    .replace(/^Already handled: /, "")
    .replace(/^Sent by Dime: /, "")
    .replace(/; left as a chip for the user$/, "");
  return { label: OUTCOME_LABEL[a.outcome], text: a.outcome === "sent" ? text : `${text}. The chip is still yours to send.` };
}

/** A check-in's banner: what its changes did (sent, chips for you, or logged in shadow). */
export function checkinBanner(c: Pick<AiConversation, "history">): string {
  let sent = 0;
  let held = 0;
  let live = 0;
  for (const t of c.history) {
    for (const p of t.parts) {
      if (p.kind !== "block") continue;
      const b = p.block;
      if (b.type === "decision" && b.action) {
        if (b.action.outcome === "sent") sent += 1;
        else held += 1;
      } else if (b.type === "proposal" && b.state !== "shadow") {
        live += 1;
      }
    }
  }
  const rate = "Mark each call agree or disagree; a follow-up here is an ordinary chat.";
  if (sent || held) {
    const did = sent ? `Dime sent ${count(sent, "move")} itself` : "Dime sent nothing itself";
    const rest = held ? `; ${count(held, "move")} it held back ${held === 1 ? "is a chip" : "are chips"} you can send` : "";
    return `${did}${rest}. ${rate}`;
  }
  if (live) return `Its changes here are chips you can send or apply. ${rate}`;
  return `In shadow: nothing in this check-in was sent to ESPN. ${rate}`;
}
