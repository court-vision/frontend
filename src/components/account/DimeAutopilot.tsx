"use client";

import { useState } from "react";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { aiMessage } from "@/hooks/useAi";
import { AI_DESK } from "@/components/desk/routes";
import { SegRail } from "@/components/desk/SegRail";
import { whenTime } from "@/components/week/format";
import { KIND_LABEL } from "@/lib/ai-checkins";
import {
  CAPABILITIES,
  CAPABILITY_HELP,
  CAPABILITY_LABEL,
  MODES,
  MODE_HELP,
  MODE_LABEL,
  heldBack,
  pauseLine,
  policyLine,
} from "@/lib/ai-autonomy";
import { teamName } from "@/lib/account";
import type { AiActing, AiAutonomyMode, AiAutopilotChange, AiAutopilotTeam, AiCapability } from "@/types/ai";
import type { AccountModel } from "./model";
import { Block, Toggle } from "./blocks";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

const ACT_OFF = "Acting is switched off on the server for now";

/**
 * The Dime block of AI and automation (the Dime autopilot plan, step 5): for each
 * team Dime runs check-ins on, the check-ins' switch and how much Dime may do
 * there, the team's mode and each kind of move's own. Both shapes are shown
 * while James decides between one setting per team and one per kind; dropping
 * either is deleting its rows here. It reads and writes through the account's
 * model, so the demo shows a sample team and keeps every change in memory.
 */
export function DimeAutopilot({ model }: { model: AccountModel }) {
  const dime = model.useDime();
  const pilots = dime.data?.teams ?? [];
  const acting = dime.data?.acting ?? null;
  return (
    <Block title="Dime">
      <div className={s.row2}>
        <span className={s.prose}>
          {pilots.length
            ? "Dime, the agent on the AI desk, suggests adds, drops and lineups in chat and makes a move only when you confirm it. On the teams below it also runs check-ins, morning and night, on what the automations above will do. How much it may do there is yours to set: in shadow it logs what it would change, in suggest its changes become chips you send, and in act it sends them itself within the limits."
            : "Dime, the agent on the AI desk, suggests adds, drops and lineups in chat and makes a move only when you confirm it. On a team it runs check-ins on, it also looks over what the automations above will do, morning and night, and logs what it would change without sending anything. Its check-ins, what it remembers about your teams and how its moves went are on the AI desk."}
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
  );
}

function statusLine(t: AiAutopilotTeam): string {
  const paused = pauseLine(t);
  if (paused) return t.paused_by === "system" ? `${paused}. Turn it back on to resume.` : "Check-ins are paused.";
  if (!t.on) return "Check-ins are off.";
  return t.next ? `On. Next: ${KIND_LABEL[t.next.kind].toLowerCase()}, ${whenTime(t.next.due_at)}.` : "On. Nothing due until the season's next game day.";
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
  const canAct = acting?.available ?? false;
  const change = (c: AiAutopilotChange, done?: string) => {
    setPending(true);
    onSet(t.team_id, c)
      .then(() => (done ? toast.success(demo ? `${done} (demo)` : done) : undefined))
      .catch((err: unknown) => toast.error(aiMessage(err, "Couldn't change that")))
      .finally(() => setPending(false));
  };
  const a = t.autonomy;
  return (
    <div className={s.pilot} data-paused-by={t.paused_by ?? undefined}>
      <Toggle
        label={name}
        help={statusLine(t)}
        checked={t.on}
        disabled={pending}
        onChange={(on) => change({ on }, on ? `Check-ins on for ${name}` : `Check-ins paused on ${name}`)}
      />
      <div className={s.pilotGrid} role="group" aria-label={`How much Dime may do on ${name}`}>
        <div className={s.pilotRow} data-team>
          <div className={s.pilotLabel}>
            <span className={s.pilotName}>The whole team</span>
            <span className={s.fieldHint}>{MODE_HELP[a.mode]}</span>
          </div>
          <ModeRail
            label={`Dime on ${name}`}
            value={a.mode}
            canAct={canAct}
            disabled={pending}
            onPick={(mode) => change({ mode })}
          />
        </div>
        {CAPABILITIES.map((c) => (
          <KindRow key={c} cap={c} pilot={t} canAct={canAct} disabled={pending} onChange={change} />
        ))}
      </div>
      <div className={s.pilotFoot}>
        {canAct && acting ? policyLine(acting.policy) : `${ACT_OFF}: Act suggests instead, so Dime's changes become chips you send.`}
      </div>
    </div>
  );
}

function KindRow({
  cap,
  pilot: t,
  canAct,
  disabled,
  onChange,
}: {
  cap: AiCapability;
  pilot: AiAutopilotTeam;
  canAct: boolean;
  disabled: boolean;
  onChange: (c: AiAutopilotChange) => void;
}) {
  const own = t.autonomy.own[cap] ?? null;
  // A pause is said once, on the switch's line
  const note = heldBack(t.autonomy, cap, false);
  return (
    <div className={s.pilotRow}>
      <div className={s.pilotLabel}>
        <span className={s.pilotName}>{CAPABILITY_LABEL[cap]}</span>
        <span className={s.fieldHint}>
          {CAPABILITY_HELP[cap]}
          {note ? <span className={s.pilotHeld}> · {note}</span> : null}
        </span>
      </div>
      <ModeRail
        label={`${CAPABILITY_LABEL[cap]} on this team`}
        value={own}
        team={MODE_LABEL[t.autonomy.mode]}
        canAct={canAct}
        disabled={disabled}
        onPick={(mode) => onChange({ own: { [cap]: mode } })}
      />
    </div>
  );
}

/** Shadow, Suggest, Act; with `team`, a first segment that follows the team's mode (null). */
function ModeRail<V extends AiAutonomyMode | null>({
  label,
  value,
  team,
  canAct,
  disabled,
  onPick,
}: {
  label: string;
  value: V;
  team?: string;
  canAct: boolean;
  disabled: boolean;
  onPick: (mode: V) => void;
}) {
  const options: Array<{ id: AiAutonomyMode | null; text: string; title: string }> = [
    ...(team !== undefined ? [{ id: null, text: "Team's", title: `Follow the team's setting (${team})` }] : []),
    ...MODES.map((m) => ({ id: m, text: MODE_LABEL[m], title: m === "act" && !canAct ? ACT_OFF : MODE_HELP[m] })),
  ];
  return (
    <SegRail label={label} active={value ?? "team"}>
      {options.map((o) => {
        const on = value === o.id;
        // Act can't be chosen while the server refuses it; one already set stays shown
        const off = disabled || (o.id === "act" && !canAct && !on);
        return (
          <button
            key={o.id ?? "team"}
            type="button"
            role="radio"
            aria-checked={on}
            className={`${dk.seg} ${on ? dk.segOn : ""}`}
            disabled={off}
            title={o.title}
            onClick={() => (on ? undefined : onPick(o.id as V))}
          >
            <span className={dk.segLabel}>{o.text}</span>
          </button>
        );
      })}
    </SegRail>
  );
}
