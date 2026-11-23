"use client";

import { useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { aiMessage, useAiAsksQuery, useCancelAiAsk } from "@/hooks/useAi";
import { useViewerZone } from "@/hooks/useViewerZone";
import { ASK_STATE_LABEL, askClosedLine, askTone } from "@/lib/ai-timeline";
import { localDateTime } from "@/lib/local-time";
import type { AiAsk, AiAskBlock as AskBlockData, AiAskState } from "@/types/ai";
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

/*
 * The user's asks (the Dime desk redesign, step 2): what they asked Dime to do at a time. Dime saves
 * one in a chat (its schedule_ask tool) and the chat shows it there (AskBlock); the timeline shows it
 * at its time (Timeline.tsx); a team with no timeline lists them over the chat (ScheduledStrip). Each
 * runs once, at its time, as a check-in of its own: one Dime turn on the check-ins budget.
 */

/** What every waiting ask says it will spend. */
export const ASK_SPEND = "Runs one Dime turn on the check-ins budget.";

type AskShown = Pick<AiAsk, "ask_id" | "what" | "due_at" | "state" | "reason" | "conversation_id">;

export function AskStateChip({ state }: { state: AiAskState }) {
  const tone = askTone(state);
  return (
    <span className={`${dk.chip} ${tone === "warn" ? dk.warnChip : dk[tone]}`}>
      {state === "running" ? <Loader2 size={10} className={dk.spin} style={{ marginRight: 4 }} /> : null}
      {ASK_STATE_LABEL[state]}
    </span>
  );
}

/** Cancel while it waits; open the check-in that ran it once there is one to read. */
export function AskActions({ ask, onCancelled, onOpen }: { ask: AskShown; onCancelled?: () => void; onOpen?: (conversationId: number) => void }) {
  const cancel = useCancelAiAsk();
  const opens = ask.conversation_id != null && ask.state !== "running" && !!onOpen;
  if (ask.state !== "pending" && !opens) return null;
  return (
    <>
      {ask.state === "pending" ? (
        <button
          type="button"
          className={`${dk.btn} ${dk.btnSmall}`}
          disabled={cancel.isPending}
          title="Cancel it: Dime won't run it"
          onClick={() =>
            cancel.mutate(ask.ask_id, {
              onSuccess: () => onCancelled?.(),
              onError: (err) => toast.error(aiMessage(err, "Couldn't cancel it")),
            })
          }
        >
          {cancel.isPending ? <Loader2 size={12} className={dk.spin} /> : null} Cancel
        </button>
      ) : null}
      {opens ? (
        <button type="button" className={`${dk.btn} ${dk.btnSmall}`} title="Open what Dime did, in the chat" onClick={() => onOpen!(ask.conversation_id!)}>
          Open
        </button>
      ) : null}
    </>
  );
}

/**
 * An ask in the chat, where Dime saved it: its time in the viewer's zone, the words Dime saved, and
 * its state as it stands (the server refreshes the stored block each time the conversation is read).
 */
export function AskBlock({ ask, onOpen }: { ask: AskBlockData; onOpen?: (conversationId: number) => void }) {
  const tz = useViewerZone();
  // The stored block is as the conversation was last read. While it waits or runs, follow the team's
  // asks (polled, and read again on a cancel) so a chat left open shows it run, and its Open
  const open = ask.state === "pending" || ask.state === "running";
  const team = useAiAsksQuery(ask.team_id, open);
  const fresh = open && team.data ? [...team.data.waiting, ...team.data.recent].find((a) => a.ask_id === ask.ask_id) : undefined;
  const now: AskShown = fresh ? { ...ask, state: fresh.state, reason: fresh.reason, conversation_id: fresh.conversation_id } : ask;
  // Cancelled here: say so at once, before either is read again
  const [cancelled, setCancelled] = useState(false);
  const shown: AskShown = cancelled && now.state === "pending" ? { ...now, state: "cancelled", reason: "user" } : now;
  const closed = askClosedLine(shown);
  return (
    <div className={s.askBlock} data-state={shown.state} role="group" aria-label="Your ask">
      <div className={s.askHead}>
        <Clock size={12} className={s.askIcon} aria-hidden />
        <span className={dk.label}>You asked for</span>
        <span className={s.askWhen}>{localDateTime(Date.parse(shown.due_at), { tz, label: true })}</span>
        <span className={dk.spacer} />
        <AskStateChip state={shown.state} />
      </div>
      <div className={s.askWhat}>{shown.what}</div>
      {closed || shown.state === "pending" || shown.conversation_id != null ? (
        <div className={s.askFoot}>
          <span className={dk.sub}>{closed ?? (shown.state === "pending" ? ASK_SPEND : shown.state === "running" ? "Dime is on it now." : "Dime ran it as a check-in.")}</span>
          <span className={dk.spacer} />
          <AskActions ask={shown} onCancelled={() => setCancelled(true)} onOpen={onOpen} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * A team with no timeline (its check-ins off) still runs what the user asks: its asks sit over the
 * chat, the ones still to run and the others due in the last day. Nothing shows while there are none.
 */
export function ScheduledStrip({ teamId, onOpen }: { teamId: number | null; onOpen: (conversationId: number) => void }) {
  const query = useAiAsksQuery(teamId, true);
  const tz = useViewerZone();
  const asks = query.data ? [...query.data.waiting, ...query.data.recent] : [];
  if (!asks.length) return null;
  return (
    <div className={s.scheduled} aria-label="Scheduled">
      <div className={s.scheduledHead}>
        <span className={dk.label}>Scheduled</span>
        {query.data!.waiting.length ? <span className={dk.sub}>Each one runs one Dime turn on the check-ins budget</span> : null}
      </div>
      <ul className={s.scheduledList}>
        {asks.map((a) => {
          const closed = askClosedLine(a);
          return (
            <li key={a.ask_id} className={s.scheduledRow} data-state={a.state}>
              <span className={s.askWhen}>{localDateTime(Date.parse(a.due_at), { tz })}</span>
              <span className={s.scheduledWhat} title={closed ? `${a.what} (${closed})` : a.what}>
                {a.what}
              </span>
              <AskStateChip state={a.state} />
              <AskActions ask={a} onOpen={onOpen} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
