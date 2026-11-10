"use client";

import { useState } from "react";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { ACCOUNT_DESK } from "@/components/desk/routes";
import { SegRail } from "@/components/desk/SegRail";
import type { DeskTeam } from "@/components/desk/TeamSwitch";
import { whenTime } from "@/components/week/format";
import { aiMessage, useAiActionsQuery } from "@/hooks/useAi";
import { KIND_LABEL } from "@/lib/ai-checkins";
import { MOVE_KIND_LABEL, OUTCOME_LABEL, ROW_LABEL, actionLine, movesOf, ruleLabel, type MovesFilter } from "@/lib/ai-autonomy";
import type { AiActing, AiActionOutcome, AiAutomationName, AiAutopilotAction } from "@/types/ai";
import { DimeView, ViewLoading } from "./DimeView";
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

const FILTERS: Array<{ id: MovesFilter; label: string }> = [
  { id: "all", label: "Everything" },
  { id: "sent", label: "Sent" },
  { id: "held", label: "Held back" },
];

const TONE: Record<AiActionOutcome, string> = { sent: dk.up, blocked: dk.warnChip, refused: dk.down, failed: dk.down };

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Dime's moves, in the AI desk's main area (the Dime autopilot plan, step 5):
 * every move Dime tried on its own on an automation at AI, newest first. What it
 * sent, and what it held back as a chip with the rule that stopped it, each with
 * the call behind it and a link to the check-in it came from. How the sent ones
 * turned out is Move results.
 */
export function DimeMoves({
  teams,
  teamId,
  teamSwitch,
  acting,
  onOpenCheckin,
}: {
  teams: DeskTeam[];
  teamId: number | null;
  teamSwitch: React.ReactNode;
  acting: AiActing | null;
  onOpenCheckin: (conversationId: number) => void;
}) {
  const [filter, setFilter] = useState<MovesFilter>("all");
  const moves = useAiActionsQuery(teamId, teamId != null);
  const all = moves.data ?? [];
  const shown = movesOf(all, filter);

  let body: React.ReactNode;
  if (teamId == null) {
    body = <div className={s.rowEmpty}>Add a team to see what Dime did on it.</div>;
  } else if (moves.isLoading) {
    body = <ViewLoading />;
  } else if (moves.isError) {
    body = (
      <div className={s.rowEmpty}>
        {aiMessage(moves.error, "Couldn't read Dime's moves")}{" "}
        <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => void moves.refetch()}>
          Try again
        </button>
      </div>
    );
  } else if (all.length === 0) {
    body = (
      <div className={s.rowEmpty}>
        {acting && !acting.available
          ? "Nothing yet: Dime's acting is switched off on the server for now, so its check-ins are reviews."
          : "Nothing yet. On automations at AI, what Dime sends itself and what it holds back show up here."}{" "}
        <Link href={`${ACCOUNT_DESK}?v=automation`} className={dk.link}>
          Automations and autopilot
        </Link>
      </div>
    );
  } else if (shown.length === 0) {
    body = <div className={s.rowEmpty}>{filter === "sent" ? "Dime hasn't sent a move itself on this team yet." : "Nothing held back on this team."}</div>;
  } else {
    body = (
      <div className={s.noteList}>
        {shown.map((m) => (
          <MoveAction key={m.action_id} move={m} onOpenCheckin={onOpenCheckin} />
        ))}
      </div>
    );
  }

  return (
    <DimeView
      label="Dime's moves"
      sub="Everything Dime did on its own on automations at AI, newest first: what it sent itself, and what it held back as a chip for you, with the rule that stopped it. How the moves turned out is in Move results."
      tools={
        <>
          {teams.length ? teamSwitch : null}
          <SegRail label="Which moves" active={filter}>
            {FILTERS.map((f) => {
              const on = filter === f.id;
              return (
                <button key={f.id} type="button" role="radio" aria-checked={on} className={`${dk.seg} ${on ? dk.segOn : ""}`} onClick={() => setFilter(f.id)}>
                  <span className={dk.segLabel}>{f.label}</span>
                </button>
              );
            })}
          </SegRail>
        </>
      }
    >
      {body}
    </DimeView>
  );
}

function MoveAction({ move: m, onOpenCheckin }: { move: AiAutopilotAction; onOpenCheckin: (conversationId: number) => void }) {
  const outcome = m.outcome as AiActionOutcome;
  const { text } = actionLine({ outcome, message: m.message });
  const rule = outcome === "sent" ? null : ruleLabel(m.rule);
  const row = ROW_LABEL[m.row as AiAutomationName] ?? m.row;
  return (
    <div className={s.moveRow}>
      <div className={s.noteHead}>
        <span className={`${dk.chip} ${TONE[outcome] ?? dk.flat}`}>{OUTCOME_LABEL[outcome] ?? m.outcome}</span>
        {rule ? (
          <span className={`${dk.chip} ${dk.flat}`} title={m.rule ?? undefined}>
            {rule}
          </span>
        ) : null}
        <span className={dk.sub}>
          {shortDate(m.date)} · {row} · {MOVE_KIND_LABEL[m.kind] ?? m.kind}
        </span>
        <span className={dk.spacer} />
        {m.at ? <span className={dk.sub}>{whenTime(m.at)}</span> : null}
      </div>
      {m.summary ? <div className={s.decisionSummary}>{m.summary}</div> : null}
      <div className={s.moveDetail}>
        <span>{text}</span>
      </div>
      {m.conversation_id != null ? (
        <button type="button" className={`${dk.btn} ${dk.btnSmall}`} style={{ alignSelf: "flex-start" }} onClick={() => onOpenCheckin(m.conversation_id!)}>
          <MessagesSquare size={12} /> {m.checkin_kind ? `The ${KIND_LABEL[m.checkin_kind].toLowerCase()} check-in` : "The check-in"}
        </button>
      ) : null}
    </div>
  );
}
