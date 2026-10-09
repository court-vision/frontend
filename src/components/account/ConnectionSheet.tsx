"use client";

import { useState } from "react";
import { KeyRound, Loader2, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { DeskDialog } from "@/components/desk/DeskDialog";
import { userMessage } from "@/lib/api-error";
import { connectionLine, connectionState, connectionTitle, leagueName, providerLabel, seasonLabel, type AccountFocus } from "@/lib/account";
import type { ProviderConnection } from "@/types/connections";
import { AccountTeamList } from "./AddTeamDialog";
import type { AccountModel } from "./model";
import { Block, Facts, ago, useNow } from "./blocks";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

interface ConnectionSheetProps {
  model: AccountModel;
  connection: ProviderConnection;
  onOpen: (focus: AccountFocus) => void;
  /** Paste new cookies for this account (ESPN). */
  onRefresh: () => void;
  /** Pick a league on this account (Yahoo). */
  onAddYahoo: () => void;
  onRemoved: () => void;
  returnTo: string;
}

/** One account: its standing with the provider, the teams reading through it, and the teams it could add. */
export function ConnectionSheet({ model, connection, onOpen, onRefresh, onAddYahoo, onRemoved, returnTo }: ConnectionSheetProps) {
  const now = useNow();
  const state = connectionState(connection);
  const espn = connection.provider === "espn";
  const accountTeams = model.useAccountTeams(espn ? connection.id : null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);

  const verify = async () => {
    setError(null);
    setVerdict(null);
    try {
      const res = await model.verify(connection.id);
      if (res) setVerdict(res.status === "ok" ? `${providerLabel(connection.provider)} accepted the credentials.` : res.status === "expired" ? `${providerLabel(connection.provider)} refused them.` : "Nothing to check them against: every league on the account is public.");
    } catch (e) {
      setError(userMessage(e));
    }
  };

  const reconnect = async () => {
    setBusy("yahoo");
    setError(null);
    try {
      await model.startYahoo(returnTo);
    } catch (e) {
      setError(userMessage(e, "Yahoo's sign-in could not be started"));
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    try {
      await model.disconnect(connection.id);
      setConfirm(false);
      onRemoved();
    } catch (e) {
      setError(userMessage(e, "The account was not disconnected"));
      setConfirm(false);
    } finally {
      setBusy(null);
    }
  };

  const addFromAccount = async (t: import("@/types/connections").EspnAccountTeam) => {
    const key = `espn:${t.league_id}:${t.espn_team_id}`;
    setBusy(key);
    setError(null);
    try {
      await model.addTeam({
        provider: "espn",
        league_id: t.league_id,
        team_name: t.team_name,
        league_name: t.league_name ?? undefined,
        year: t.season,
        espn_connection_id: connection.id,
      });
    } catch (e) {
      setError(userMessage(e, "The team was not added"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <span className={s.headTitle}>{connectionTitle(connection)}</span>
          <span className={s.headSub}>
            {espn
              ? "One ESPN account's cookies, stored encrypted and shared by every team on it. ESPN rotates them now and then; when it does, one paste here fixes every team."
              : "A Yahoo sign-in, refreshed by Court Vision as its tokens age. Yahoo granted read access, so lineups show but are not sent."}
          </span>
          <span className={s.headChips}>
            <span className={`${dk.chip} ${state.tone === "ok" ? dk.up : state.tone === "warn" ? dk.warnChip : dk.flat}`}>{state.label}</span>
            <span className={`${dk.chip} ${dk.flat}`}>{connectionLine(connection, now)}</span>
            <span className={`${dk.chip} ${dk.flat}`}>
              {connection.teams.length} {connection.teams.length === 1 ? "team" : "teams"}
            </span>
          </span>
        </div>
        <div className={s.headActions}>
          <button type="button" className={dk.btn} disabled={model.verifying === connection.id} onClick={() => void verify()}>
            {model.verifying === connection.id ? <Loader2 size={13} className={dk.spin} /> : <ShieldCheck size={13} />} Check
          </button>
          {espn ? (
            <button type="button" className={`${dk.btn} ${connection.status === "expired" ? dk.btnPrimary : ""}`} onClick={onRefresh}>
              <KeyRound size={13} /> Update cookies
            </button>
          ) : (
            <button type="button" className={`${dk.btn} ${connection.status === "expired" ? dk.btnPrimary : ""}`} disabled={busy === "yahoo"} onClick={() => void reconnect()}>
              {busy === "yahoo" ? <Loader2 size={13} className={dk.spin} /> : <RefreshCw size={13} />} Reconnect
            </button>
          )}
          <button type="button" className={`${dk.btn} ${dk.btnDanger}`} onClick={() => setConfirm(true)}>
            <Unplug size={13} /> Disconnect
          </button>
        </div>
      </header>

      {error || verdict ? (
        <div className={s.block}>
          {error ? <div className={s.formError}>{error}</div> : null}
          {verdict ? (
            <div className={s.formNote} data-tone={connection.status === "ok" ? "ok" : connection.status === "expired" ? "warn" : undefined}>
              {verdict}
            </div>
          ) : null}
        </div>
      ) : null}

      {connection.status === "expired" ? (
        <div className={s.block}>
          <div className={s.formNote} data-tone="warn">
            {providerLabel(connection.provider)} rejected this account&apos;s {espn ? "cookies" : "login"} {ago(connection.auth_failed_at, now)}. Every team on it fails to read until {espn ? "new cookies are pasted" : "it is reconnected"}.
          </div>
        </div>
      ) : null}

      <Block title="Standing" note={`with ${providerLabel(connection.provider)}`}>
        <Facts
          items={[
            ["Status", state.label],
            ["Last check", connection.verified_at ? `accepted ${ago(connection.verified_at, now)}` : "never accepted yet"],
            ...(connection.auth_failed_at ? ([["Last refusal", ago(connection.auth_failed_at, now)]] as Array<[string, React.ReactNode]>) : []),
            ["Saved", ago(connection.updated_at, now)],
            ["Connected", ago(connection.created_at, now)],
          ]}
        />
        {espn && connection.status === "unknown" ? (
          <span className={s.fieldHint} style={{ display: "block", marginTop: 10 }}>
            Not verified means the cookies were saved but no private league was there to check them against. They are used all the same.
          </span>
        ) : null}
      </Block>

      <Block title="Teams reading through it" note={connection.teams.length ? `${connection.teams.length}` : "none"}>
        {connection.teams.length === 0 ? (
          <div className={s.blockEmpty}>No team reads through this account yet.</div>
        ) : (
          <div className={s.list}>
            {connection.teams.map((t) => (
              <button key={t.team_id} type="button" className={s.item} onClick={() => onOpen({ kind: "team", id: t.team_id })}>
                <span className={s.itemBody}>
                  <span className={s.itemName}>
                    <span>{t.team_name}</span>
                  </span>
                  <span className={s.itemSub}>{[leagueName(t.league_name, t.league_id), seasonLabel(connection.provider, t.year)].filter(Boolean).join(" · ")}</span>
                </span>
                <span className={s.itemRight}>
                  <span className={dk.sub}>open</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Block>

      {espn ? (
        <Block title="On ESPN, not here yet" note={accountTeams.loading ? "asking ESPN…" : undefined} right={<button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => accountTeams.refetch()}>Refresh</button>}>
          <AccountTeamList loading={accountTeams.loading} error={accountTeams.error} teams={accountTeams.data ?? []} busy={busy} onAdd={(t) => void addFromAccount(t)} only="untracked" />
        </Block>
      ) : (
        <Block title="Add a team from this account">
          <div className={s.row2}>
            <span className={s.prose}>Pick one of the account&apos;s leagues, then the team that is yours.</span>
            <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={onAddYahoo}>
              Choose a league
            </button>
          </div>
        </Block>
      )}

      <DeskDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Disconnect the ${connectionTitle(connection)}?`}
        description={
          connection.teams.length
            ? `Its ${connection.teams.length === 1 ? "team stays" : `${connection.teams.length} teams stay`} but ${connection.teams.length === 1 ? "loses" : "lose"} ${espn ? "the cookies, so a private league stops answering" : "the Yahoo login, so reads stop"} until an account is linked again. The stored credentials are deleted.`
            : "The stored credentials are deleted. Nothing else changes."
        }
        footer={
          <button type="button" className={`${dk.btn} ${dk.btnDanger}`} disabled={busy === "disconnect"} onClick={() => void disconnect()}>
            {busy === "disconnect" ? <Loader2 size={13} className={dk.spin} /> : <Unplug size={13} />} Disconnect
          </button>
        }
      />
    </div>
  );
}
