"use client";

import { alertMinutes, NOTIFICATION_FIELDS, notificationSummary, type AccountFocus } from "@/lib/account";
import type { AccountModel } from "./model";
import { Toggle } from "./blocks";
import { AccountSettings, TeamSettings, type FieldsProps, type SettingsKind } from "./SettingsBlocks";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

const MINUTES = [30, 60, 90, 120, 150];

function NotificationFields({ prefs, onChange, email, disabled }: FieldsProps) {
  const sub = !prefs.lineup_alerts_enabled;
  const minutes = alertMinutes(prefs);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Toggle
        label="Email me before tip-off"
        help="When a starter is out or benched for a game, or a bench player has one and a starter does not."
        checked={prefs.lineup_alerts_enabled}
        disabled={disabled}
        onChange={(v) => onChange({ ...prefs, lineup_alerts_enabled: v })}
      />
      <div className={s.toggleRow} style={{ opacity: sub ? 0.5 : 1 }}>
        <div className={s.toggleBody}>
          <span className={s.toggleLabel}>How early</span>
          <span className={s.toggleHelp}>Minutes before the night&apos;s first tip-off. Setting the lineup for you runs at the same time.</span>
        </div>
        <div className={dk.rail}>
          {MINUTES.map((m) => (
            <button
              key={m}
              type="button"
              className={`${dk.seg} ${minutes === m ? dk.segOn : ""}`}
              disabled={disabled || sub}
              onClick={() => onChange({ ...prefs, alert_minutes_before: m })}
            >
              {minutes === m ? <span className={dk.segPill} /> : null}
              <span className={dk.segLabel}>{m}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={s.toggleRow} style={{ opacity: sub ? 0.5 : 1 }}>
        <div className={s.toggleBody}>
          <span className={s.toggleLabel}>Send to</span>
          <span className={s.toggleHelp}>{email ? `Blank means the account's address, ${email}.` : "Blank means the account's address."}</span>
        </div>
        <input
          type="email"
          className={dk.input}
          style={{ width: 240 }}
          placeholder={email ?? "you@example.com"}
          value={prefs.email ?? ""}
          disabled={disabled || sub}
          onChange={(e) => onChange({ ...prefs, email: e.target.value || null })}
        />
      </div>
    </div>
  );
}

const NOTIFICATIONS: SettingsKind = {
  fields: NOTIFICATION_FIELDS,
  Fields: NotificationFields,
  summary: notificationSummary,
  own: "own settings",
};

/** Notifications: the email before tip-off, one setting for the account, and a team's own where it differs. */
export function NotificationsSheet({ model, onOpen }: { model: AccountModel; onOpen: (focus: AccountFocus) => void }) {
  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <span className={s.headTitle}>Notifications</span>
          <span className={s.headSub}>
            An email before the night&apos;s first tip-off when your lineup has a hole: a starter who is out or has no game while a bench player does. One setting for the account; any team can have its own.
          </span>
        </div>
      </header>

      <AccountSettings model={model} kind={NOTIFICATIONS} onOpen={onOpen} />
      <TeamSettings model={model} kind={NOTIFICATIONS} onOpen={onOpen} />
    </div>
  );
}
