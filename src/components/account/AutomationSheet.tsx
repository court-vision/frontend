"use client";

import { Bell } from "lucide-react";
import { automationSummary, AUTOMATION_FIELDS, type AccountFocus } from "@/lib/account";
import { ACCOUNT_LEVELS, accountOptions, belowAi, lineupPrefs, ROW_LABEL } from "@/lib/ai-autonomy";
import type { AiAutomationName } from "@/types/ai";
import type { AccountModel } from "./model";
import { DimeAutopilot } from "./DimeAutopilot";
import { LevelRail } from "./LevelRail";
import { AccountSettings, TeamSettings, type FieldsProps, type SettingsKind } from "./SettingsBlocks";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

/** The automations the account's table lists: AI and check-ins are per team, in the Dime block. */
const ACCOUNT_ROWS: AiAutomationName[] = ["lineup", "daily_actions", "lanes", "late_scratch"];

const ACCOUNT_HELP: Record<string, string> = {
  lineup:
    "Notify is the tip-off email. Act also sets the lineup before tip-off: bench players with a game move into spots held by players without one. Healthy starters stay, IR is untouched, and the email says what changed.",
  daily_actions: "The Week desk's IR moves and the day's pickup and drop. Its email and Court Vision making the moves aren't built yet.",
  lanes: "Your stream lanes run as you set them in the Week desk.",
  late_scratch:
    "News and late scratches before a player's game. Its email and the late-scratch swap aren't built yet; at AI, on a team Dime runs, an event check-in answers them before the game locks.",
};

/** Off, Notify or Act for each automation: the account's, or a team's own over it. */
function AutomationFields({ prefs, onChange, disabled, onOpen, account }: FieldsProps) {
  // A team's own Notify and Act need the account's lineup email: the pipeline skips everyone without it
  const accountEmail = account ? account.lineup_alerts_enabled : true;
  return (
    <div className={s.pilotGrid} role="group" aria-label="Automations">
      {ACCOUNT_ROWS.map((row) => (
        <div key={row} className={s.pilotRow}>
          <div className={s.pilotLabel}>
            <span className={s.pilotName}>{ROW_LABEL[row]}</span>
            <span className={s.fieldHint}>{ACCOUNT_HELP[row]}</span>
          </div>
          <LevelRail
            label={ROW_LABEL[row]}
            options={accountOptions(row, accountEmail)}
            value={belowAi(row, prefs)}
            disabled={disabled}
            onPick={(level) => {
              if (row === "lineup" && ACCOUNT_LEVELS.includes(level)) onChange({ ...prefs, ...lineupPrefs(level) });
            }}
          />
        </div>
      ))}
      {!accountEmail ? (
        <div className={s.row2} style={{ padding: "6px 14px 8px" }}>
          <span className={s.fieldHint}>The account&apos;s Lineup is off, so no team&apos;s lineup runs. Set it to Notify or Act above, or turn the tip-off email on.</span>
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

/** AI and automation: what Court Vision does on your teams by itself, and what Dime does there. */
export function AutomationSheet({ model, onOpen }: { model: AccountModel; onOpen: (focus: AccountFocus) => void }) {
  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <span className={s.headTitle}>AI and automation</span>
          <span className={s.headSub}>
            What Court Vision does on your teams without asking each time: Off, Notify (an email says what is due) or Act (Court Vision does it). One setting for the account; any team can have its own. On teams Dime runs on, each automation can also be at AI.
          </span>
        </div>
      </header>

      <AccountSettings model={model} kind={AUTOMATION} onOpen={onOpen} />
      <TeamSettings model={model} kind={AUTOMATION} onOpen={onOpen} />
      <DimeAutopilot model={model} />
    </div>
  );
}
