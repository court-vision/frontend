"use client";

import { useState } from "react";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { aiMessage } from "@/hooks/useAi";
import { AI_DESK } from "@/components/desk/routes";
import { whenTime } from "@/components/week/format";
import { KIND_LABEL } from "@/lib/ai-checkins";
import { AUTOPILOT_NOTE, ROW_HELP, checkinsLabels, pauseLine, policyLine } from "@/lib/ai-autonomy";
import { teamName } from "@/lib/account";
import type { AiActing, AiAutomationRow, AiAutopilotChange, AiAutopilotTeam, AiFeatures, AiLevel } from "@/types/ai";
import type { AccountModel } from "./model";
import { Block, Toggle } from "./blocks";
import { LevelRail } from "./LevelRail";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

const ACT_OFF = "Autopilot is switched off on the server for now: no check-in runs and nothing at AI sends until it is back.";

/**
 * The Dime block of AI and automation (the Dime autopilot plan's automation levels):
 * for each team Dime runs on, the autopilot switch over its automations table, each
 * row at Off, Notify, Act or AI with the levels it can't do dimmed and saying why.
 * Under the teams, the account's AI features. It reads and writes through the
 * account's model, so the demo shows a sample team and keeps every change in memory.
 */
export function DimeAutopilot({ model }: { model: AccountModel }) {
  const dime = model.useDime();
  const pilots = dime.data?.teams ?? [];
  const acting = dime.data?.acting ?? null;
  const features = dime.data?.features ?? null;
  return (
    <>
      <Block title="Dime">
        <div className={s.row2}>
          <span className={s.prose}>
            {pilots.length
              ? "Dime, the agent on the AI desk, suggests adds, drops and lineups in chat and makes a move only when you confirm it. On the teams below, each automation can also be at AI: Dime does it, looking the plan over in its check-ins, acting within the limits and logging every call. Autopilot puts every automation at AI."
              : "Dime, the agent on the AI desk, suggests adds, drops and lineups in chat and makes a move only when you confirm it. On a team Dime runs on, each automation can also be at AI, and autopilot puts all of them there. Its check-ins, what it remembers about your teams and its moves are on the AI desk."}
          </span>
          <Link href={AI_DESK} className={`${dk.btn} ${dk.btnSmall}`}>
            <MessagesSquare size={12} /> Open the AI desk
          </Link>
        </div>
        {pilots.map((t) => {
          const team = model.teams.find((x) => x.team_id === t.team_id);
          return (
            <PilotTeam
              key={t.team_id}
              pilot={t}
              name={team ? teamName(team) : `Team ${t.team_id}`}
              acting={acting}
              demo={model.demo}
              onSet={model.setDime}
            />
          );
        })}
      </Block>
      {features ? <Features features={features} demo={model.demo} onSet={model.setFeatures} /> : null}
    </>
  );
}

function statusLine(t: AiAutopilotTeam): string {
  const paused = pauseLine(t);
  if (paused) return t.paused_by === "system" ? `${paused}. Resume check-ins below and it picks up again.` : "Check-ins are paused.";
  return t.next ? `Next check-in: ${KIND_LABEL[t.next.kind].toLowerCase()}, ${whenTime(t.next.due_at)}.` : "No check-in due until the season's next game day.";
}

function PilotTeam({
  pilot: t,
  name,
  acting,
  demo,
  onSet,
}: {
  pilot: AiAutopilotTeam;
  name: string;
  acting: AiActing | null;
  demo: boolean;
  onSet: AccountModel["setDime"];
}) {
  const [pending, setPending] = useState(false);
  const change = (c: AiAutopilotChange, done?: string) => {
    setPending(true);
    onSet(t.team_id, c)
      .then(() => (done ? toast.success(demo ? `${done} (demo)` : done) : undefined))
      .catch((err: unknown) => toast.error(aiMessage(err, "Couldn't change that")))
      .finally(() => setPending(false));
  };
  const pick = (r: AiAutomationRow, level: AiLevel) => {
    // Pausing check-ins leaves the switch on; any other row changed under it turns it off, the rest staying at AI
    if (r.row === "checkins") {
      const on = level === "ai";
      change({ checkins: on }, on ? `Check-ins on for ${name}` : `Check-ins paused on ${name}`);
    } else change({ levels: { [r.row]: level } }, t.autopilot ? `Autopilot is off on ${name}; the other automations stay at AI` : undefined);
  };
  const labels = checkinsLabels(t);
  return (
    <div className={s.pilot} data-paused-by={t.paused_by ?? undefined}>
      <Toggle
        label={`Autopilot on ${name}`}
        help={
          <>
            {t.autopilot
              ? "Every automation is at AI, check-ins are on and so are Dime's memory and draft rooms. Changing a row turns autopilot off."
              : "Puts every automation at AI, turns check-ins on and turns on Dime's memory and draft rooms. Turning it off puts the automations back."}{" "}
            {statusLine(t)}
          </>
        }
        checked={t.autopilot}
        disabled={pending}
        onChange={(on) =>
          change({ autopilot: on }, on ? `Autopilot on for ${name}: every automation at AI` : `Autopilot off on ${name}: the automations are back where they were`)
        }
      />
      <div className={s.pilotGrid} role="group" aria-label={`Automations on ${name}`}>
        {t.rows.map((r) => (
          <div key={r.row} className={s.pilotRow}>
            <div className={s.pilotLabel}>
              <span className={s.pilotName}>{r.label}</span>
              <span className={s.fieldHint}>
                {ROW_HELP[r.row]}
                {r.note ? <span className={r.note === AUTOPILOT_NOTE ? undefined : s.pilotHeld}> · {r.note}</span> : null}
              </span>
            </div>
            <LevelRail
              label={`${r.label} on ${name}`}
              options={r.options}
              value={r.level}
              labels={r.row === "checkins" ? labels : undefined}
              disabled={pending}
              onPick={(level) => pick(r, level)}
            />
          </div>
        ))}
      </div>
      <div className={s.pilotFoot}>{acting?.available ? policyLine(acting.policy) : ACT_OFF}</div>
    </div>
  );
}

/** The account's AI features: what isn't an automation, so it has no row in the table. */
function Features({
  features,
  demo,
  onSet,
}: {
  features: AiFeatures;
  demo: boolean;
  onSet: AccountModel["setFeatures"];
}) {
  const [pending, setPending] = useState(false);
  const change = (c: Partial<AiFeatures>, done: string) => {
    setPending(true);
    onSet(c)
      .then(() => toast.success(demo ? `${done} (demo)` : done))
      .catch((err: unknown) => toast.error(aiMessage(err, "Couldn't change that")))
      .finally(() => setPending(false));
  };
  return (
    <Block title="AI features">
      <Toggle
        label="Memory"
        help={
          features.memory ? (
            <>
              Dime keeps notes on your teams, your league and how its moves went, and reads them every turn.{" "}
              <Link href={`${AI_DESK}?v=memory`}>Read and edit them</Link> on the AI desk.
            </>
          ) : (
            <>
              Dime neither reads nor writes notes. The notes stay, and you can still <Link href={`${AI_DESK}?v=memory`}>edit them</Link>.
            </>
          )
        }
        checked={features.memory}
        disabled={pending}
        onChange={(memory) => change({ memory }, memory ? "Dime's memory is on" : "Dime's memory is off")}
      />
      <Toggle
        label="Dime in draft rooms"
        help={
          features.draft_rooms ? (
            <>
              A Dime section in every draft room: a plan that sets the room&apos;s punts, a note as each of your picks comes up, your seat in a mock, and a recap. Its notes are in{" "}
              <Link href={`${AI_DESK}?v=drafts`}>Draft notes</Link> on the AI desk.
            </>
          ) : (
            <>
              Draft rooms show no Dime section, and Dime holding a mock seat hands it back before its next pick. Its notes stay in{" "}
              <Link href={`${AI_DESK}?v=drafts`}>Draft notes</Link>.
            </>
          )
        }
        checked={features.draft_rooms}
        disabled={pending}
        onChange={(draft_rooms) => change({ draft_rooms }, draft_rooms ? "Dime is back in draft rooms" : "Dime is out of draft rooms")}
      />
    </Block>
  );
}
