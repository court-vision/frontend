"use client";

import type { AccountFocus } from "@/lib/account";
import type { AccountModel } from "./model";
import { TeamAutomations } from "./TeamAutomations";
import s from "./account.module.css";

/** AI and automation: what Court Vision and Dime do on each of your teams by themselves, team by team. */
export function AutomationSheet({ model, team, onOpen }: { model: AccountModel; team?: number; onOpen: (focus: AccountFocus) => void }) {
  const dime = model.useDime();
  const ai = !!dime.data;
  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <span className={s.headTitle}>AI and automation</span>
          <span className={s.headSub}>
            {ai
              ? "What Court Vision and Dime do on each of your teams without asking each time. Every automation is Off, Notify (an email says what is due), Act (Court Vision does it) or AI (Dime does it, within its limits, and logs every call). Autopilot puts all of a team's automations at AI."
              : "What Court Vision does on each of your teams without asking each time. Every automation is Off, Notify (an email says what is due) or Act (Court Vision does it)."}
          </span>
        </div>
      </header>

      <TeamAutomations model={model} expand={team} onOpen={onOpen} />
    </div>
  );
}
