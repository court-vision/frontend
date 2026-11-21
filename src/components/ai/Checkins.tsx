"use client";

import { Check, X } from "lucide-react";
import { actionLine } from "@/lib/ai-autonomy";
import { decisionKicker } from "@/lib/ai-checkins";
import { localizeProseClocks } from "@/lib/local-time";
import { useViewerZone } from "@/hooks/useViewerZone";
import type { AiDecisionBlock, AiVerdict } from "@/types/ai";
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

/*
 * A check-in's calls inside its conversation (the Dime autopilot plan, steps 3 and 5). The check-ins
 * themselves are on the AI desk's timeline (Timeline.tsx), which opens one here as its conversation.
 */

/** The call a check-in logged, with the user's agree / disagree. */
export function DecisionBlock({
  decision: d,
  onVerdict,
  date,
}: {
  decision: AiDecisionBlock;
  /** Absent while the turn is still streaming. */
  onVerdict?: (decisionId: number, verdict: AiVerdict | null) => void;
  /** The NBA date the call was made on, for its Eastern clock times; today's when left out. */
  date?: string;
}) {
  const set = (v: AiVerdict) => onVerdict?.(d.decision_id, d.verdict === v ? null : v);
  // Dime's own words, its Eastern clock times in the viewer's zone (as in its answers)
  const tz = useViewerZone();
  return (
    <div className={s.decision} data-call={d.call} data-verdict={d.verdict ?? undefined} role="group" aria-label="Dime's call">
      <div className={s.decisionHead}>
        <span className={s.decisionCall} data-call={d.call}>
          {d.call === "hold" ? "Hold" : "Change"}
        </span>
        <span className={dk.label}>{decisionKicker(d)}</span>
      </div>
      <div className={s.decisionSummary}>{localizeProseClocks(d.summary, date, { tz })}</div>
      <div className={s.decisionReason}>{localizeProseClocks(d.reason, date, { tz })}</div>
      {d.action ? <DecisionAction action={d.action} /> : null}
      {onVerdict ? (
        <div className={s.decisionFoot}>
          <button type="button" className={s.verdict} data-verdict="agree" aria-pressed={d.verdict === "agree"} onClick={() => set("agree")}>
            <Check size={12} strokeWidth={3} /> Agree
          </button>
          <button type="button" className={s.verdict} data-verdict="disagree" aria-pressed={d.verdict === "disagree"} onClick={() => set("disagree")}>
            <X size={12} strokeWidth={3} /> Disagree
          </button>
          <span className={dk.sub}>{d.verdict ? "Click again to clear" : "Would you have made the same call?"}</span>
        </div>
      ) : null}
    </div>
  );
}

/** What Dime did about a change on an automation at AI: sent it, or held it back as a chip with the rule that stopped it. */
function DecisionAction({ action }: { action: NonNullable<AiDecisionBlock["action"]> }) {
  const { label, text } = actionLine(action);
  return (
    <div className={s.decisionAction} data-outcome={action.outcome}>
      <span className={s.decisionActionLabel}>{label}</span>
      <span>{text}</span>
    </div>
  );
}
