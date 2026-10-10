"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { userMessage } from "@/lib/api-error";
import { teamName } from "@/lib/account";
import type { NotificationPreference, NotificationTeamPreference } from "@/types/notifications";
import type { TeamResponseData } from "@/types/team";
import type { AccountModel } from "./model";
import { Block, Skeleton, Toggle } from "./blocks";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

const MINUTES = [30, 60, 90, 120, 150];

/** The team's own settings over the account's, as one complete set. */
export function effectivePrefs(base: NotificationPreference, override: NotificationTeamPreference | undefined): NotificationPreference {
  if (!override?.has_override) return base;
  return {
    lineup_alerts_enabled: override.lineup_alerts_enabled ?? base.lineup_alerts_enabled,
    alert_benched_starters: override.alert_benched_starters ?? base.alert_benched_starters,
    alert_active_non_playing: override.alert_active_non_playing ?? base.alert_active_non_playing,
    alert_injured_active: override.alert_injured_active ?? base.alert_injured_active,
    alert_minutes_before: override.alert_minutes_before ?? base.alert_minutes_before,
    auto_lineup_enabled: override.auto_lineup_enabled ?? base.auto_lineup_enabled,
    email: override.email ?? base.email,
  };
}

function AlertFields({
  prefs,
  onChange,
  email,
  disabled,
}: {
  prefs: NotificationPreference;
  onChange: (next: NotificationPreference) => void;
  email: string | null;
  disabled?: boolean;
}) {
  const sub = !prefs.lineup_alerts_enabled;
  const minutes = Math.min(150, Math.max(15, prefs.alert_minutes_before));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Toggle
        label="Email me before tip-off"
        help="When a starter is out or benched for a game, or a bench player has one and a starter does not."
        checked={prefs.lineup_alerts_enabled}
        disabled={disabled}
        onChange={(v) => onChange({ ...prefs, lineup_alerts_enabled: v })}
      />
      <Toggle
        label="Set the lineup for me"
        help="Before tip-off, bench players with a game move into spots held by players without one. Healthy starters stay, IR is untouched, and the email says what changed."
        checked={prefs.auto_lineup_enabled}
        disabled={disabled || sub}
        onChange={(v) => onChange({ ...prefs, auto_lineup_enabled: v })}
      />
      <div className={s.toggleRow} style={{ opacity: sub ? 0.5 : 1 }}>
        <div className={s.toggleBody}>
          <span className={s.toggleLabel}>How early</span>
          <span className={s.toggleHelp}>Minutes before the night&apos;s first tip-off.</span>
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

/** Lineup alerts: one setting for the account, and a team's own where it differs. */
export function AlertsSheet({ model }: { model: AccountModel }) {
  const prefs = model.usePrefs();
  const teamPrefs = model.useTeamPrefs();
  const [draft, setDraft] = useState<NotificationPreference | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = prefs.data;
  const shown = draft ?? base;
  const dirty = !!draft && !!base && JSON.stringify(draft) !== JSON.stringify(base);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await model.savePrefs(draft);
      setDraft(null);
    } catch (e) {
      setError(userMessage(e, "The settings were not saved"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <span className={s.headTitle}>Lineup alerts</span>
          <span className={s.headSub}>
            An email before the night&apos;s first tip-off when your lineup has a hole: a starter who is out or has no game while a bench player does. One setting for the account; any team can have its own.
          </span>
        </div>
      </header>

      <Block title="For the account" note={prefs.loading ? "loading…" : undefined} right={dirty ? <button type="button" className={`${dk.btn} ${dk.btnPrimary} ${dk.btnSmall}`} disabled={saving} onClick={() => void save()}>{saving ? <Loader2 size={12} className={dk.spin} /> : null} Save</button> : undefined}>
        {prefs.loading ? (
          <Skeleton rows={4} />
        ) : prefs.error ? (
          <div className={s.formError}>{prefs.error}</div>
        ) : shown ? (
          <>
            {error ? <div className={s.formError} style={{ marginBottom: 10 }}>{error}</div> : null}
            <AlertFields prefs={shown} onChange={setDraft} email={model.user?.email ?? null} />
          </>
        ) : null}
      </Block>

      <Block title="Per team" note={teamPrefs.loading ? "loading…" : `${model.teams.length}`}>
        {teamPrefs.loading || !base ? (
          <Skeleton rows={3} />
        ) : teamPrefs.error ? (
          <div className={s.formError}>{teamPrefs.error}</div>
        ) : model.teams.length === 0 ? (
          <div className={s.blockEmpty}>No teams yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {model.teams.map((team) => (
              <TeamAlerts key={team.team_id} model={model} team={team} base={base} override={(teamPrefs.data ?? []).find((p) => p.team_id === team.team_id)} />
            ))}
          </div>
        )}
      </Block>
    </div>
  );
}

function TeamAlerts({ model, team, base, override }: { model: AccountModel; team: TeamResponseData; base: NotificationPreference; override: NotificationTeamPreference | undefined }) {
  const custom = !!override?.has_override;
  const current = effectivePrefs(base, override);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<NotificationPreference>(current);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setDraft(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, override, base]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      setEditing(false);
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const summary = current.lineup_alerts_enabled
    ? `on · ${Math.min(150, Math.max(15, current.alert_minutes_before))} min before${current.auto_lineup_enabled ? " · sets the lineup" : ""}${current.email ? ` · ${current.email}` : ""}`
    : "off";

  return (
    <div className={s.list}>
      <div className={s.item}>
        <span className={s.itemBody}>
          <span className={s.itemName}>
            <span>{teamName(team)}</span>
            {custom ? <span className={`${dk.chip} ${dk.pv}`}>own settings</span> : <span className={`${dk.chip} ${dk.flat}`}>account&apos;s</span>}
          </span>
          <span className={s.itemSub}>{summary}</span>
        </span>
        <span className={s.itemRight}>
          {editing ? (
            <>
              <button type="button" className={`${dk.btn} ${dk.btnSmall}`} disabled={busy != null} onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={`${dk.btn} ${dk.btnPrimary} ${dk.btnSmall}`}
                disabled={busy != null}
                onClick={() =>
                  void run("save", () =>
                    model.saveTeamPrefs(team.team_id, {
                      lineup_alerts_enabled: draft.lineup_alerts_enabled,
                      alert_benched_starters: draft.alert_benched_starters,
                      alert_active_non_playing: draft.alert_active_non_playing,
                      alert_injured_active: draft.alert_injured_active,
                      alert_minutes_before: draft.alert_minutes_before,
                      auto_lineup_enabled: draft.auto_lineup_enabled,
                      email: draft.email,
                    })
                  )
                }
              >
                {busy === "save" ? <Loader2 size={12} className={dk.spin} /> : null} Save
              </button>
            </>
          ) : (
            <>
              {custom ? (
                <button type="button" className={`${dk.btn} ${dk.btnSmall}`} disabled={busy != null} onClick={() => void run("clear", () => model.clearTeamPrefs(team.team_id))}>
                  {busy === "clear" ? <Loader2 size={12} className={dk.spin} /> : null} Use the account&apos;s
                </button>
              ) : null}
              <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => setEditing(true)}>
                {custom ? "Edit" : "Customize"}
              </button>
            </>
          )}
        </span>
      </div>
      {editing ? (
        <div style={{ padding: "4px 12px 10px" }}>
          {error ? <div className={s.formError} style={{ marginBottom: 8 }}>{error}</div> : null}
          <AlertFields prefs={draft} onChange={setDraft} email={model.user?.email ?? null} />
        </div>
      ) : null}
    </div>
  );
}
