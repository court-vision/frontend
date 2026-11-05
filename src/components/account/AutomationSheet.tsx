"use client";

import { Bell } from "lucide-react";
import { AUTOMATION_FIELDS, automationSummary, type AccountFocus } from "@/lib/account";
import type { AccountModel } from "./model";
import { Toggle } from "./blocks";
import { DimeAutopilot } from "./DimeAutopilot";
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

      <DimeAutopilot model={model} />
    </div>
  );
}
