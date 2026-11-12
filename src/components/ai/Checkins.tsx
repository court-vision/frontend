"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, Play, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { aiMessage, useRunAiCheckin } from "@/hooks/useAi";
import { KIND_HELP, KIND_LABEL, RUN_KINDS, STATE_LABEL, agreement, checkinLine, decisionKicker, eventsShown } from "@/lib/ai-checkins";
import { actionLine, autopilotLive, pauseLine, teamLine } from "@/lib/ai-autonomy";
import { whenTime } from "@/components/week/format";
import { ACCOUNT_DESK } from "@/components/desk/routes";
import type { DeskTeam } from "@/components/desk/TeamSwitch";
import type { AiActing, AiAutopilotTeam, AiCheckin, AiCheckinRunKind, AiCheckins, AiDecisionBlock, AiVerdict } from "@/types/ai";
import { DimeView, ViewLoading } from "./DimeView";
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

/** Where the automations, check-ins and autopilot are set: settings stay in settings. */
const SETTINGS_HREF = `${ACCOUNT_DESK}?v=automation`;
/** The word teamLine opens with on a team under the switch. */
const AUTOPILOT_WORD = "Autopilot";

/**
 * Dime's check-ins, in the AI desk's main area (the Dime autopilot plan, steps 3
 * and 5): each team Dime may run them on, with what is at AI there, its next
 * check-in and Run now, the month's spend and how often the user agrees, then the
 * check-ins themselves. A check-in opens here as its conversation. On automations
 * at AI Dime sends its changes itself; anywhere else a change is a review. The
 * user marks each call agree or disagree. The automations table and the autopilot
 * switch are in Account > AI and automation.
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
  const acting = data?.acting ?? null;
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
                acting={acting}
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
            <Settings2 size={12} style={{ verticalAlign: -1 }} /> Automations and autopilot
          </Link>
        </div>
        {checkins.length === 0 ? (
          <div className={s.rowEmpty}>
            {anyOn
              ? "No check-ins yet. Dime runs its first at the next one due, or run one now."
              : "No check-ins yet. Turn them on (or put an automation at AI) and Dime runs its first at the next one due, or run one now."}
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
      sub="Turns Dime starts on its own on the teams it runs on, on its schedule and, with Late scratches at AI, when news comes in about a rostered player. It reads what auto-lineup, the lanes and the scheduled pickups will do and logs every call it makes, holds included. On automations at AI it sends its changes itself, within the limits; anywhere else a change is a review, logged and not sent. Open one to mark each call agree or disagree."
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
      <CheckinEvents checkin={c} />
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

/** What came in that the check-in took: a verdict that changed before a game, a news item. */
function CheckinEvents({ checkin }: { checkin: AiCheckin }) {
  const { shown, more } = eventsShown(checkin);
  if (!shown.length) return null;
  return (
    // Spans, not a list: the row is a button when it opens
    <span className={s.checkinEvents} title="What came in about the roster">
      {shown.map((e, i) => (
        <span key={`${e.source}-${e.player_id}-${i}`} className={s.checkinEvent} data-source={e.source}>
          {e.summary}
        </span>
      ))}
      {more ? <span className={s.checkinEvent}>and {more} more</span> : null}
    </span>
  );
}

function AutopilotTeam({ team, name, acting, running }: { team: AiAutopilotTeam; name: string; acting: AiActing | null; running: boolean }) {
  const run = useRunAiCheckin();
  const [kind, setKind] = useState<AiCheckinRunKind | "">("");
  const next = team.on
    ? team.next
      ? `Next: ${KIND_LABEL[team.next.kind].toLowerCase()}, ${whenTime(team.next.due_at)}`
      : "Nothing due until the season's next game day"
    : `${pauseLine(team) ?? "Off"}. No scheduled check-ins until you resume them`;
  // Autopilot running the team wears the spectrum here too: the card's edge, and the word that opens its line
  const live = autopilotLive(team, acting);
  const line = teamLine(team, acting);
  return (
    <div className={live ? `${s.autopilot} ${s.autopilotLive} ${dk.spectrumEdge}` : s.autopilot}>
      <div className={s.autopilotHead}>
        <span className={s.autopilotName}>{name}</span>
        <span className={dk.spacer} />
        <span className={`${dk.chip} ${team.on ? dk.up : dk.flat}`}>{team.on ? "On" : team.paused_at ? "Paused" : "Off"}</span>
      </div>
      <Link href={SETTINGS_HREF} className={s.autopilotMode} title="Set the automations and autopilot in Account">
        {live && line.startsWith(AUTOPILOT_WORD) ? (
          <>
            <span className={dk.spectrumText}>{AUTOPILOT_WORD}</span>
            {line.slice(AUTOPILOT_WORD.length)}
          </>
        ) : (
          line
        )}
      </Link>
      <span className={dk.sub} data-paused-by={team.paused_by ?? undefined}>
        {next}
      </span>
      <div className={s.autopilotRun}>
        <select
          className={s.select}
          value={kind}
          aria-label="Which check-in to run"
          title={kind ? KIND_HELP[kind] : "By the clock: morning, pre-lock in the hours before the first tip, the night follow-up after it"}
          onChange={(e) => setKind(e.target.value as AiCheckinRunKind | "")}
        >
          <option value="">By the clock</option>
          {RUN_KINDS.map((k) => (
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
