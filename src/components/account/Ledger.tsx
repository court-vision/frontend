"use client";

import { Bell, LayoutDashboard, Plus, UserRound } from "lucide-react";
import { YAHOO_ENABLED, YAHOO_SOON, connectionForTeam, connectionState, connectionTitle, focusKey, leagueName, teamName, teamTag, type AccountFocus } from "@/lib/account";
import type { ProviderConnection } from "@/types/connections";
import type { TeamResponseData } from "@/types/team";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

export type LedgerAction = { kind: "add" } | { kind: "connect"; provider: "espn" | "yahoo" };

/** Every row the ledger shows, in order, so the keyboard walks the same list the eye does. */
export type LedgerRow = { focus: AccountFocus } | { action: LedgerAction };

export function ledgerRows(teams: readonly TeamResponseData[], connections: readonly ProviderConnection[]): LedgerRow[] {
  return [
    { focus: { kind: "overview" } },
    ...teams.map((t): LedgerRow => ({ focus: { kind: "team", id: t.team_id } })),
    { action: { kind: "add" } },
    ...connections.map((c): LedgerRow => ({ focus: { kind: "connection", id: c.id } })),
    { action: { kind: "connect", provider: "espn" } },
    { action: { kind: "connect", provider: "yahoo" } },
    { focus: { kind: "alerts" } },
    { focus: { kind: "account" } },
  ];
}

export function rowKey(row: LedgerRow): string {
  return "focus" in row ? focusKey(row.focus) : row.action.kind === "add" ? "add" : `connect:${row.action.provider}`;
}

interface LedgerProps {
  teams: TeamResponseData[];
  connections: ProviderConnection[];
  focus: AccountFocus;
  cursor: number;
  rows: LedgerRow[];
  alertsOn: boolean | null;
  email: string | null;
  loading: boolean;
  onOpen: (focus: AccountFocus) => void;
  onAction: (action: LedgerAction) => void;
  onCursor: (i: number) => void;
}

/**
 * The ledger: the overview, your teams, the accounts they read through, and
 * the two things about you. A team or an account in trouble carries a dot.
 */
export function Ledger({ teams, connections, focus, cursor, rows, alertsOn, email, loading, onOpen, onAction, onCursor }: LedgerProps) {
  const indexOf = (key: string) => rows.findIndex((r) => rowKey(r) === key);
  const cls = (key: string, on: boolean, extra?: string) =>
    [s.row, on ? s.rowOn : "", indexOf(key) === cursor ? s.rowCursor : "", extra ?? ""].filter(Boolean).join(" ");

  return (
    <aside className={s.ledger} aria-label="Account">
      <div className={s.rows} aria-label="Teams, accounts and settings">
        <button type="button" className={cls("overview", focus.kind === "overview")} onClick={() => onOpen({ kind: "overview" })} onMouseEnter={() => onCursor(indexOf("overview"))}>
          <span className={s.rowIcon}>
            <LayoutDashboard size={14} />
          </span>
          <span className={s.rowBody}>
            <span className={s.rowName}>
              <span>Overview</span>
            </span>
            <span className={s.rowSub}>what needs doing, every team at a glance</span>
          </span>
          <span className={s.rowRight}>
            <span className={dk.kbd}>⏎</span>
          </span>
        </button>

        <div className={s.group}>
          <span className={dk.label}>Teams</span>
          <span className={s.blockNote}>{loading ? "loading…" : teams.length}</span>
        </div>
        {loading ? (
          <div className={s.ledgerSkel}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={dk.skel} style={{ width: `${86 - i * 12}%` }} />
            ))}
          </div>
        ) : null}
        {teams.map((t) => {
          const key = focusKey({ kind: "team", id: t.team_id });
          const connection = connectionForTeam(connections, t.team_id);
          const warn = connection?.status === "expired";
          return (
            <button
              key={t.team_id}
              type="button"
              className={cls(key, focus.kind === "team" && focus.id === t.team_id)}
              onClick={() => onOpen({ kind: "team", id: t.team_id })}
              onMouseEnter={() => onCursor(indexOf(key))}
            >
              <span className={s.rowIcon}>
                <span className={s.dot} data-tone={warn ? "warn" : connection ? "ok" : undefined} title={warn ? "The account's credentials were rejected" : connection ? "Reads through a connected account" : "No connected account"} />
              </span>
              <span className={s.rowBody}>
                <span className={s.rowName}>
                  <span>{teamName(t)}</span>
                </span>
                <span className={s.rowSub}>{leagueName(t.league?.name ?? t.league_info.league_name, t.league_info.league_id)}</span>
              </span>
              <span className={s.rowRight}>{teamTag(t)}</span>
            </button>
          );
        })}
        {!loading && teams.length === 0 ? <div className={s.ledgerEmpty}>No teams yet.</div> : null}
        <button type="button" className={cls("add", false, s.rowAdd)} onClick={() => onAction({ kind: "add" })} onMouseEnter={() => onCursor(indexOf("add"))}>
          <span className={s.rowIcon}>
            <Plus size={14} />
          </span>
          <span className={s.rowBody}>
            <span className={s.rowName}>
              <span>Add a team…</span>
            </span>
          </span>
          <span className={s.rowRight}>
            <span className={dk.kbd}>A</span>
          </span>
        </button>

        <div className={s.group}>
          <span className={dk.label}>Accounts</span>
          <span className={s.blockNote}>{loading ? "" : connections.length}</span>
        </div>
        {connections.map((c) => {
          const key = focusKey({ kind: "connection", id: c.id });
          const state = connectionState(c);
          return (
            <button
              key={c.id}
              type="button"
              className={cls(key, focus.kind === "connection" && focus.id === c.id)}
              onClick={() => onOpen({ kind: "connection", id: c.id })}
              onMouseEnter={() => onCursor(indexOf(key))}
            >
              <span className={s.rowIcon}>
                <span className={s.dot} data-tone={state.tone === "ok" ? "ok" : state.tone === "warn" ? "warn" : undefined} title={state.label} />
              </span>
              <span className={s.rowBody}>
                <span className={s.rowName}>
                  <span>{connectionTitle(c)}</span>
                </span>
                <span className={s.rowSub}>
                  {state.label.toLowerCase()} · {c.teams.length} {c.teams.length === 1 ? "team" : "teams"}
                </span>
              </span>
              <span className={s.rowRight}>{c.provider.toUpperCase()}</span>
            </button>
          );
        })}
        {!loading && connections.length === 0 ? <div className={s.ledgerEmpty}>No account connected. Teams in public leagues work without one.</div> : null}
        <button type="button" className={cls("connect:espn", false, s.rowAdd)} onClick={() => onAction({ kind: "connect", provider: "espn" })} onMouseEnter={() => onCursor(indexOf("connect:espn"))}>
          <span className={s.rowIcon}>
            <Plus size={14} />
          </span>
          <span className={s.rowBody}>
            <span className={s.rowName}>
              <span>Connect ESPN…</span>
            </span>
          </span>
        </button>
        <button
          type="button"
          className={cls("connect:yahoo", false, s.rowAdd)}
          disabled={!YAHOO_ENABLED}
          title={YAHOO_ENABLED ? undefined : YAHOO_SOON}
          onClick={() => onAction({ kind: "connect", provider: "yahoo" })}
          onMouseEnter={() => onCursor(indexOf("connect:yahoo"))}
        >
          <span className={s.rowIcon}>
            <Plus size={14} />
          </span>
          <span className={s.rowBody}>
            <span className={s.rowName}>
              <span>Connect Yahoo…</span>
            </span>
            {!YAHOO_ENABLED ? <span className={s.rowSub}>waiting on Yahoo&apos;s developer access</span> : null}
          </span>
          {!YAHOO_ENABLED ? (
            <span className={s.rowRight}>
              <span className={`${dk.chip} ${dk.warnChip}`}>soon</span>
            </span>
          ) : null}
        </button>

        <div className={s.group}>
          <span className={dk.label}>You</span>
        </div>
        <button type="button" className={cls("alerts", focus.kind === "alerts")} onClick={() => onOpen({ kind: "alerts" })} onMouseEnter={() => onCursor(indexOf("alerts"))}>
          <span className={s.rowIcon}>
            <Bell size={14} />
          </span>
          <span className={s.rowBody}>
            <span className={s.rowName}>
              <span>Lineup alerts</span>
            </span>
            <span className={s.rowSub}>{alertsOn == null ? "before tip-off" : alertsOn ? "on, before tip-off" : "off"}</span>
          </span>
        </button>
        <button type="button" className={cls("account", focus.kind === "account")} onClick={() => onOpen({ kind: "account" })} onMouseEnter={() => onCursor(indexOf("account"))}>
          <span className={s.rowIcon}>
            <UserRound size={14} />
          </span>
          <span className={s.rowBody}>
            <span className={s.rowName}>
              <span>Account</span>
            </span>
            <span className={s.rowSub}>{email ?? "sign-in, theme"}</span>
          </span>
        </button>
      </div>
    </aside>
  );
}
