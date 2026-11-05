"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, Play, X } from "lucide-react";
import { toast } from "sonner";
import { aiMessage, useRunAiCheckin, useSetAiAutopilot } from "@/hooks/useAi";
import { KIND_HELP, KIND_LABEL, STATE_LABEL, agreement, checkinLine, decisionKicker } from "@/lib/ai-checkins";
import { actionLine, autonomyLine, pauseLine } from "@/lib/ai-autonomy";
import { ACCOUNT_DESK } from "@/components/desk/routes";
import { whenTime } from "@/components/week/format";
import type { DeskTeam } from "@/components/desk/TeamSwitch";
import type { AiAutopilotTeam, AiCheckin, AiCheckinKind, AiCheckins, AiDecisionAction, AiDecisionBlock, AiVerdict } from "@/types/ai";
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

/**
 * Dime's check-ins in the AI desk's side list (the Dime autopilot plan, step 3):
 * each team Dime may run them on, with its switch, its next check-in and Run now,
 * then the check-ins themselves. A check-in opens like any conversation. The
 * user marks each call agree or disagree. How much Dime may do on a team (step
 * 5) is set in Account, AI and automation: in shadow nothing a check-in does is
 * sent, in suggest its changes are chips, in act Dime sends them itself and each
 * call says what became of its move.
 */
export function CheckinList({
  data,
  loading,
  teams,
  current,
  onOpen,
}: {
  data: AiCheckins | undefined;
  loading: boolean;
  teams: DeskTeam[];
  current: number | null;
  onOpen: (conversationId: number) => void;
}) {
  const checkins = data?.checkins ?? [];
  const { agree, rated } = agreement(checkins);
  return (
    <div className={s.listScroll}>
      {(data?.teams ?? []).map((t) => (
        <AutopilotTeam key={t.team_id} team={t} name={teams.find((x) => x.id === t.team_id)?.name ?? `Team ${t.team_id}`} running={checkins.some((c) => c.team_id === t.team_id && c.state === "running")} />
      ))}
      {data ? (
        <div className={s.checkinMeta}>
          <span title="What check-ins cost this month, on their own budget apart from your chats">
            ${data.month_usd.toFixed(2)} of ${data.cap_usd.toFixed(0)} this month
          </span>
          {rated ? (
            <span title="Of the calls you've rated in this list">
              You agree with {agree} of {rated}
            </span>
          ) : null}
        </div>
      ) : null}
      {loading ? (
        <div className={s.rowEmpty} aria-busy>
          <span className={dk.skel} style={{ width: "80%" }} />
        </div>
      ) : checkins.length === 0 ? (
        <div className={s.rowEmpty}>No check-ins yet. Switch them on and Dime runs its first at the next one due, or run one now.</div>
      ) : (
        checkins.map((c) => <CheckinRow key={c.checkin_id} checkin={c} current={current} onOpen={onOpen} />)
      )}
    </div>
  );
}

function CheckinRow({ checkin: c, current, onOpen }: { checkin: AiCheckin; current: number | null; onOpen: (id: number) => void }) {
  const open = c.conversation_id != null && c.state !== "running";
  const on = c.conversation_id != null && c.conversation_id === current;
  const body = (
    <>
      <span className={s.rowTitle}>
        {c.state === "running" ? <Loader2 size={11} className={dk.spin} style={{ display: "inline-block", marginRight: 5, verticalAlign: -1 }} /> : null}
        {c.title}
        {c.manual ? <span className={dk.sub}> · run by you</span> : null}
      </span>
      <span className={dk.sub} data-state={c.state}>
        {checkinLine(c)}
      </span>
    </>
  );
  if (!open) {
    return (
      <div className={`${s.row} ${s.rowStatic}`} title={c.state === "running" ? "Dime is working on it; it opens when it finishes" : STATE_LABEL[c.state]}>
        {body}
      </div>
    );
  }
  return (
    <button type="button" className={`${s.row} ${on ? s.rowOn : ""}`} aria-current={on ? "page" : undefined} onClick={() => onOpen(c.conversation_id!)}>
      {body}
    </button>
  );
}

const KINDS: AiCheckinKind[] = ["morning", "weekly", "pre_lock", "night"];
const AUTOMATION_SETTINGS = `${ACCOUNT_DESK}?v=automation`;

function AutopilotTeam({ team, name, running }: { team: AiAutopilotTeam; name: string; running: boolean }) {
  const toggle = useSetAiAutopilot();
  const run = useRunAiCheckin();
  const [kind, setKind] = useState<AiCheckinKind | "">("");
  const next = team.on
    ? team.next
      ? `Next: ${KIND_LABEL[team.next.kind].toLowerCase()}, ${whenTime(team.next.due_at)}`
      : "Nothing due until the season's next game day"
    : (pauseLine(team) ?? "Off");
  return (
    <div className={s.autopilot}>
      <div className={s.autopilotHead}>
        <span className={s.autopilotName}>{name}</span>
        <span className={dk.spacer} />
        <span className={dk.sub}>{team.on ? "On" : "Off"}</span>
        <button
          type="button"
          role="switch"
          aria-checked={team.on}
          aria-label={`Dime's check-ins on ${name}`}
          title={team.on ? "Pause the scheduled check-ins" : "Run check-ins on this team's schedule"}
          className={s.switch}
          disabled={toggle.isPending}
          onClick={() =>
            toggle.mutate({ teamId: team.team_id, on: !team.on }, { onError: (err) => toast.error(aiMessage(err, "Couldn't change that")) })
          }
        />
      </div>
      <span className={dk.sub} data-paused-by={team.paused_by ?? undefined}>
        {next}
      </span>
      <Link href={AUTOMATION_SETTINGS} className={s.autopilotMode} title="How much Dime may do on this team: set it in Account, AI and automation">
        {autonomyLine(team.autonomy)}
      </Link>
      <div className={s.autopilotRun}>
        <select
          className={s.select}
          value={kind}
          aria-label="Which check-in to run"
          title={kind ? KIND_HELP[kind] : "By the clock: morning, pre-lock in the hours before the first tip, the night follow-up after it"}
          onChange={(e) => setKind(e.target.value as AiCheckinKind | "")}
        >
          <option value="">By the clock</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`${dk.btn} ${dk.btnSmall}`}
          disabled={running || run.isPending}
          title={running ? "A check-in is running on this team" : "Run a check-in now, off the schedule"}
          onClick={() =>
            run.mutate(
              { teamId: team.team_id, kind: kind || undefined },
              {
                onSuccess: () => toast.success("Dime is on it. The check-in opens here when it finishes."),
                onError: (err) => toast.error(aiMessage(err, "Couldn't start the check-in")),
              }
            )
          }
        >
          {run.isPending ? <Loader2 size={12} className={dk.spin} /> : <Play size={12} />} Run now
        </button>
      </div>
    </div>
  );
}

/** The call a check-in logged, with the user's agree / disagree. */
export function DecisionBlock({
  decision: d,
  onVerdict,
}: {
  decision: AiDecisionBlock;
  /** Absent while the turn is still streaming. */
  onVerdict?: (decisionId: number, verdict: AiVerdict | null) => void;
}) {
  const set = (v: AiVerdict) => onVerdict?.(d.decision_id, d.verdict === v ? null : v);
  return (
    <div className={s.decision} data-call={d.call} data-verdict={d.verdict ?? undefined} role="group" aria-label="Dime's call">
      <div className={s.decisionHead}>
        <span className={s.decisionCall} data-call={d.call}>
          {d.call === "hold" ? "Hold" : "Change"}
        </span>
        <span className={dk.label}>{decisionKicker(d)}</span>
      </div>
      <div className={s.decisionSummary}>{d.summary}</div>
      <div className={s.decisionReason}>{d.reason}</div>
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

/** What became of a change in an area that acts: sent by Dime, or held back and left as a chip. */
function DecisionAction({ action }: { action: AiDecisionAction }) {
  const { label, text } = actionLine(action);
  return (
    <div className={s.decisionAction} data-outcome={action.outcome}>
      <span className={s.decisionActionLabel}>{label}</span>
      <span>{text}</span>
    </div>
  );
}
