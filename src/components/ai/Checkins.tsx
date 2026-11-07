"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, Play, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { aiMessage, useRunAiCheckin } from "@/hooks/useAi";
import { KIND_HELP, KIND_LABEL, STATE_LABEL, agreement, checkinLine, decisionKicker } from "@/lib/ai-checkins";
import { whenTime } from "@/components/week/format";
import { ACCOUNT_DESK } from "@/components/desk/routes";
import type { DeskTeam } from "@/components/desk/TeamSwitch";
import type { AiAutopilotTeam, AiCheckin, AiCheckinKind, AiCheckins, AiDecisionBlock, AiVerdict } from "@/types/ai";
import { DimeView, ViewLoading } from "./DimeView";
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

/** Where check-ins are switched on and off: settings stay in settings. */
const SETTINGS_HREF = `${ACCOUNT_DESK}?v=automation`;

/**
 * Dime's check-ins, in the AI desk's main area (the Dime autopilot plan, step 3):
 * each team Dime may run them on, with its next check-in and Run now, the month's
 * spend and how often the user agrees, then the check-ins themselves. A check-in
 * opens here as its conversation. In shadow: nothing a check-in does is sent; the
 * user marks each call agree or disagree, and that agreement is what decides when
 * Dime may act. The on/off switch is in Account > AI and automation.
 */
export function CheckinsView({
  data,
  loading,
  error,
  onRetry,
  teams,
  onOpen,
}: {
  data: AiCheckins | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  teams: DeskTeam[];
  onOpen: (conversationId: number) => void;
}) {
  const checkins = data?.checkins ?? [];
  const autopilot = data?.teams ?? [];
  const { agree, rated } = agreement(checkins);
  const anyOn = autopilot.some((t) => t.on);

  let body: React.ReactNode;
  if (loading) {
    body = <ViewLoading />;
  } else if (error && !data) {
    body = (
      <div className={s.rowEmpty}>
        {aiMessage(error, "Couldn't read the check-ins")}{" "}
        <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  } else if (autopilot.length === 0 && checkins.length === 0) {
    body = <div className={s.rowEmpty}>Dime runs check-ins only on the teams it&apos;s set up for, and none of yours is yet.</div>;
  } else {
    body = (
      <>
        {autopilot.length ? (
          <div className={s.teamCards}>
            {autopilot.map((t) => (
              <AutopilotTeam
                key={t.team_id}
                team={t}
                name={teams.find((x) => x.id === t.team_id)?.name ?? `Team ${t.team_id}`}
                running={checkins.some((c) => c.team_id === t.team_id && c.state === "running")}
              />
            ))}
          </div>
        ) : null}
        <div className={s.checkinMeta}>
          {data ? (
            <span title="What check-ins cost this month, on their own budget apart from your chats">
              ${data.month_usd.toFixed(2)} of ${data.cap_usd.toFixed(0)} this month
            </span>
          ) : null}
          {rated ? <span title="Of the calls you've rated in this list">You agree with {agree} of {rated}</span> : null}
          <span className={dk.spacer} />
          <Link href={SETTINGS_HREF} className={dk.link}>
            <Settings2 size={12} style={{ verticalAlign: -1 }} /> Switch check-ins on or off
          </Link>
        </div>
        {checkins.length === 0 ? (
          <div className={s.rowEmpty}>
            {anyOn ? "No check-ins yet. Dime runs its first at the next one due, or run one now." : "No check-ins yet. Switch them on and Dime runs its first at the next one due, or run one now."}
          </div>
        ) : (
          <div className={s.viewList}>
            {checkins.map((c) => (
              <CheckinRow key={c.checkin_id} checkin={c} onOpen={onOpen} />
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <DimeView
      label="Check-ins"
      sub="Turns Dime starts on its own on the teams it runs on, in shadow: it reads what auto-lineup, the lanes and the scheduled pickups will do, logs every call it makes, holds included, and sends nothing. Open one to mark each call agree or disagree."
    >
      {body}
    </DimeView>
  );
}

function CheckinRow({ checkin: c, onOpen }: { checkin: AiCheckin; onOpen: (id: number) => void }) {
  const open = c.conversation_id != null && c.state !== "running";
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
    <button type="button" className={s.row} onClick={() => onOpen(c.conversation_id!)}>
      {body}
    </button>
  );
}

const KINDS: AiCheckinKind[] = ["morning", "weekly", "pre_lock", "night"];

function AutopilotTeam({ team, name, running }: { team: AiAutopilotTeam; name: string; running: boolean }) {
  const run = useRunAiCheckin();
  const [kind, setKind] = useState<AiCheckinKind | "">("");
  const next = team.on
    ? team.next
      ? `Next: ${KIND_LABEL[team.next.kind].toLowerCase()}, ${whenTime(team.next.due_at)}`
      : "Nothing due until the season's next game day"
    : team.paused_at
      ? "Paused: no scheduled check-ins"
      : "Off: no scheduled check-ins";
  return (
    <div className={s.autopilot}>
      <div className={s.autopilotHead}>
        <span className={s.autopilotName}>{name}</span>
        <span className={dk.spacer} />
        <span className={`${dk.chip} ${team.on ? dk.up : dk.flat}`}>{team.on ? "On" : team.paused_at ? "Paused" : "Off"}</span>
      </div>
      <span className={dk.sub}>{next}</span>
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
