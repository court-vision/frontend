"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { AUTOMATION_FIELDS, automationSummary, teamName, type AccountFocus } from "@/lib/account";
import { reasonWords } from "@/lib/ai-checkins";
import { userMessage } from "@/lib/api-error";
import { AI_DESK } from "@/components/desk/routes";
import type { AccountModel } from "./model";
import { Block, Toggle } from "./blocks";
import { AccountSettings, TeamSettings, type FieldsProps, type SettingsKind } from "./SettingsBlocks";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

function AutomationFields({ prefs, onChange, disabled, onOpen }: FieldsProps) {
  const waiting = !prefs.lineup_alerts_enabled;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Toggle
        label="Set the lineup for me"
        help="Before tip-off, bench players with a game move into spots held by players without one. Healthy starters stay, IR is untouched, and the tip-off email says what changed."
        checked={prefs.auto_lineup_enabled}
        // Waiting on the email, it can still be turned off, just not on.
        disabled={disabled || (waiting && !prefs.auto_lineup_enabled)}
        onChange={(v) => onChange({ ...prefs, auto_lineup_enabled: v })}
      />
      {waiting ? (
        <div className={s.row2} style={{ padding: "2px 0 6px" }}>
          <span className={s.fieldHint}>It runs with the tip-off email, at the email&apos;s time, so it waits until that email is on.</span>
          <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => onOpen({ kind: "alerts" })}>
            <Bell size={12} /> Open notifications
          </button>
        </div>
      ) : null}
    </div>
  );
}

const AUTOMATION: SettingsKind = {
  fields: AUTOMATION_FIELDS,
  Fields: AutomationFields,
  summary: automationSummary,
  own: "own setting",
};

/** AI and automation: what Court Vision does on your teams by itself, and where Dime fits. */
export function AutomationSheet({ model, onOpen }: { model: AccountModel; onOpen: (focus: AccountFocus) => void }) {
  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <span className={s.headTitle}>AI and automation</span>
          <span className={s.headSub}>What Court Vision does on your teams without asking each time. One setting for the account; any team can have its own.</span>
        </div>
      </header>

      <AccountSettings model={model} kind={AUTOMATION} onOpen={onOpen} />
      <TeamSettings model={model} kind={AUTOMATION} onOpen={onOpen} />

      <Block title="Dime">
        <div className={s.row2}>
          <span className={s.prose}>
            Dime, the agent on the AI desk, suggests adds, drops and lineups in chat and makes a move only when you confirm it. On a team it runs check-ins on, it also looks over what the automations above will do, morning and night, and logs what it would change without sending anything. Its check-ins, what it remembers about your teams and how its moves went are on the AI desk.
          </span>
          <Link href={AI_DESK} className={`${dk.btn} ${dk.btnSmall}`}>
            <MessagesSquare size={12} /> Open the AI desk
          </Link>
        </div>
        <CheckinSwitches model={model} />
      </Block>
    </div>
  );
}

/** One Check-ins switch per team Dime may run them on; nothing when it runs them on none. */
function CheckinSwitches({ model }: { model: AccountModel }) {
  const checkinTeams = model.useCheckinTeams();
  const [busy, setBusy] = useState<number | null>(null);
  const rows = checkinTeams.data ?? [];
  if (!rows.length) return null;
  const name = (id: number) => {
    const t = model.teams.find((x) => x.team_id === id);
    return t ? teamName(t) : `Team ${id}`;
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
      {rows.map((t) => (
        <Toggle
          key={t.team_id}
          label={`Check-ins on ${name(t.team_id)}`}
          help={
            <>
              {t.on
                ? "Dime runs its morning, pre-lock and night check-ins here in shadow: it logs every call and sends nothing."
                : t.paused_by === "system"
                  ? `Paused by Court Vision${t.paused_reason ? `: ${reasonWords(t.paused_reason)}` : ""}. Switch it back on to resume.`
                  : "Off: no scheduled check-ins. Run now on the AI desk still works."}{" "}
              <Link href={`${AI_DESK}?v=checkins`} className={dk.link}>
                See the check-ins
              </Link>
            </>
          }
          checked={t.on}
          disabled={busy === t.team_id}
          onChange={(on) => {
            setBusy(t.team_id);
            model
              .setCheckins(t.team_id, on)
              .catch((err) => toast.error(userMessage(err, "Couldn't change that")))
              .finally(() => setBusy(null));
          }}
        />
      ))}
    </div>
  );
}
