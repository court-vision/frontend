"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { userMessage } from "@/lib/api-error";
import { clearPatch, effectivePrefs, hasOwn, ownPatch, teamName, type AccountFocus, type PrefFields } from "@/lib/account";
import type { NotificationPreference, NotificationTeamPreference } from "@/types/notifications";
import type { TeamResponseData } from "@/types/team";
import type { AccountModel } from "./model";
import { Block, Skeleton } from "./blocks";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

/**
 * What the two settings sheets share: the account's own settings with a Save,
 * and each team's where it differs. A sheet names its fields and draws them;
 * it reads the whole stored set and writes only its own part of it.
 */

export interface FieldsProps {
  prefs: NotificationPreference;
  onChange: (next: NotificationPreference) => void;
  email: string | null;
  disabled?: boolean;
  onOpen: (focus: AccountFocus) => void;
  /** The account's own settings, when these are a team's over them. */
  account?: NotificationPreference;
}

export interface SettingsKind {
  fields: PrefFields;
  Fields: (props: FieldsProps) => React.ReactNode;
  /** One line for a team's row: what is in force there. */
  summary: (prefs: NotificationPreference) => string;
  /** The chip on a team with its own settings here. */
  own: string;
}

export function AccountSettings({ model, kind, onOpen }: { model: AccountModel; kind: SettingsKind; onOpen: (focus: AccountFocus) => void }) {
  const prefs = model.usePrefs();
  const [draft, setDraft] = useState<NotificationPreference | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = prefs.data;
  const shown = draft ?? base;
  const dirty = !!draft && !!base && JSON.stringify(draft) !== JSON.stringify(base);
  const { Fields } = kind;

  const save = async () => {
    if (!draft || !base) return;
    setSaving(true);
    setError(null);
    try {
      // The stored set as it is, with only this sheet's fields from the draft.
      await model.savePrefs({ ...base, ...ownPatch(draft, kind.fields) } as NotificationPreference);
      setDraft(null);
    } catch (e) {
      setError(userMessage(e, "The settings were not saved"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Block
      title="For the account"
      note={prefs.loading ? "loading…" : undefined}
      right={
        dirty ? (
          <button type="button" className={`${dk.btn} ${dk.btnPrimary} ${dk.btnSmall}`} disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 size={12} className={dk.spin} /> : null} Save
          </button>
        ) : undefined
      }
    >
      {prefs.loading ? (
        <Skeleton rows={4} />
      ) : prefs.error ? (
        <div className={s.formError}>{prefs.error}</div>
      ) : shown ? (
        <>
          {error ? <div className={s.formError} style={{ marginBottom: 10 }}>{error}</div> : null}
          <Fields prefs={shown} onChange={setDraft} email={model.user?.email ?? null} onOpen={onOpen} disabled={saving} />
        </>
      ) : null}
    </Block>
  );
}

export function TeamSettings({ model, kind, onOpen }: { model: AccountModel; kind: SettingsKind; onOpen: (focus: AccountFocus) => void }) {
  const prefs = model.usePrefs();
  const teamPrefs = model.useTeamPrefs();
  const base = prefs.data;

  return (
    <Block title="Per team" note={teamPrefs.loading ? "loading…" : `${model.teams.length}`}>
      {!base && prefs.error ? (
        <div className={s.formError}>{prefs.error}</div>
      ) : teamPrefs.loading || !base ? (
        <Skeleton rows={3} />
      ) : teamPrefs.error ? (
        <div className={s.formError}>{teamPrefs.error}</div>
      ) : model.teams.length === 0 ? (
        <div className={s.blockEmpty}>No teams yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {model.teams.map((team) => (
            <TeamRow key={team.team_id} model={model} kind={kind} team={team} base={base} override={(teamPrefs.data ?? []).find((p) => p.team_id === team.team_id)} onOpen={onOpen} />
          ))}
        </div>
      )}
    </Block>
  );
}

function TeamRow({
  model,
  kind,
  team,
  base,
  override,
  onOpen,
}: {
  model: AccountModel;
  kind: SettingsKind;
  team: TeamResponseData;
  base: NotificationPreference;
  override: NotificationTeamPreference | undefined;
  onOpen: (focus: AccountFocus) => void;
}) {
  const custom = hasOwn(override, kind.fields);
  const current = effectivePrefs(base, override);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<NotificationPreference>(current);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { Fields } = kind;

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

  const backToAccount = () => {
    const patch = clearPatch(override, kind.fields);
    return patch ? model.saveTeamPrefs(team.team_id, patch) : model.clearTeamPrefs(team.team_id);
  };

  return (
    <div className={s.list}>
      <div className={s.item}>
        <span className={s.itemBody}>
          <span className={s.itemName}>
            <span>{teamName(team)}</span>
            {custom ? <span className={`${dk.chip} ${dk.pv}`}>{kind.own}</span> : <span className={`${dk.chip} ${dk.flat}`}>account&apos;s</span>}
          </span>
          <span className={s.itemSub}>{kind.summary(current)}</span>
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
                onClick={() => void run("save", () => model.saveTeamPrefs(team.team_id, ownPatch(draft, kind.fields)))}
              >
                {busy === "save" ? <Loader2 size={12} className={dk.spin} /> : null} Save
              </button>
            </>
          ) : (
            <>
              {custom ? (
                <button type="button" className={`${dk.btn} ${dk.btnSmall}`} disabled={busy != null} onClick={() => void run("clear", backToAccount)}>
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
      {editing || error ? (
        <div style={{ padding: "4px 12px 10px" }}>
          {error ? <div className={s.formError} style={{ marginBottom: editing ? 8 : 0 }}>{error}</div> : null}
          {editing ? <Fields prefs={draft} onChange={setDraft} email={model.user?.email ?? null} onOpen={onOpen} disabled={busy != null} account={base} /> : null}
        </div>
      ) : null}
    </div>
  );
}
