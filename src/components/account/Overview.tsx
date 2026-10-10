"use client";

import { AlertTriangle, Info, Plus } from "lucide-react";
import {
  YAHOO_ENABLED,
  YAHOO_SOON,
  connectionForTeam,
  connectionTitle,
  formatLabel,
  issues,
  leagueName,
  providerLabel,
  seasonLabel,
  teamName,
  writeSummary,
  type AccountFocus,
  type IssueTarget,
} from "@/lib/account";
import type { AccountModel } from "./model";
import { Block } from "./blocks";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

interface OverviewProps {
  model: AccountModel;
  alertsOn: boolean | null;
  onOpen: (focus: AccountFocus) => void;
  onAdd: () => void;
  onTarget: (target: IssueTarget) => void;
}

/** The overview: the account in numbers, what needs doing, and every team in one table. */
export function Overview({ model, alertsOn, onOpen, onAdd, onTarget }: OverviewProps) {
  const { teams, connections } = model;
  const list = issues(teams, connections);
  const connected = connections.filter((c) => c.status === "ok").length;
  const writers = teams.filter((t) => t.capabilities?.lineup_write).length;

  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <span className={s.headTitle}>{model.demo ? "A sample account" : "Your account"}</span>
          <span className={s.headSub}>
            The teams Court Vision follows, the ESPN and Yahoo accounts they read through, and the alerts. An account is connected once; every team on it draws on it. What changes here shows up on the Week desk straight away.
          </span>
        </div>
        <div className={s.headActions}>
          <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} onClick={onAdd}>
            <Plus size={13} /> Add a team
          </button>
        </div>
      </header>

      <div className={s.tape} aria-label="At a glance">
        <div className={s.tick}>
          <span className={dk.label}>Teams</span>
          <span className={s.tickValue}>{teams.length}</span>
          <span className={s.tickSub}>{writers} can send lineups</span>
        </div>
        <div className={s.tick}>
          <span className={dk.label}>Accounts</span>
          <span className={s.tickValue}>{connections.length}</span>
          <span className={s.tickSub}>{connected} connected and checked</span>
        </div>
        <div className={s.tick}>
          <span className={dk.label}>Lineup alerts</span>
          <span className={s.tickValue}>{alertsOn == null ? "—" : alertsOn ? "on" : "off"}</span>
          <span className={s.tickSub}>{alertsOn ? "before the first tip-off" : "an email before tip-off"}</span>
        </div>
      </div>

      <Block title="Needs doing" note={list.length ? `${list.length}` : "nothing"}>
        {list.length === 0 ? (
          <div className={s.blockEmpty}>Everything is in order: every account checked, every league synced.</div>
        ) : (
          <div className={s.issues}>
            {list.map((issue) => (
              <div key={issue.id} className={s.issue} data-level={issue.level}>
                <span className={s.issueIcon}>{issue.level === "warn" ? <AlertTriangle size={14} /> : <Info size={14} />}</span>
                <span className={s.issueText}>{issue.text}</span>
                <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => onTarget(issue.target)}>
                  {issue.action}
                </button>
              </div>
            ))}
          </div>
        )}
      </Block>

      <Block title="Teams" note={teams.length ? `${teams.length}` : undefined}>
        {teams.length === 0 ? (
          <div className={s.blockEmpty}>None yet. Add one and the Week desk fills in with its matchup, lineups and the market.</div>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>League</th>
                  <th>Season</th>
                  <th>Format</th>
                  <th>Account</th>
                  <th>Can send</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => {
                  const c = connectionForTeam(connections, t.team_id);
                  return (
                    <tr key={t.team_id} onClick={() => onOpen({ kind: "team", id: t.team_id })}>
                      <td className={s.tableName}>
                        {teamName(t)}
                        {t.team_id === model.selectedTeamId ? (
                          <span className={`${dk.chip} ${dk.flat}`} style={{ marginLeft: 8 }}>
                            on the desk
                          </span>
                        ) : null}
                      </td>
                      <td>{leagueName(t.league?.name ?? t.league_info.league_name, t.league_info.league_id)}</td>
                      <td className={s.tableMono}>{seasonLabel(t.league_info.provider, t.league?.season ?? t.league_info.year) ?? "—"}</td>
                      <td>{formatLabel(t.league)}</td>
                      <td className={c?.status === "expired" ? "" : s.tableMuted} style={c?.status === "expired" ? { color: "var(--warn)" } : undefined}>
                        {c ? `${connectionTitle(c)}${c.status === "expired" ? " · expired" : ""}` : t.league_info.has_espn_credentials || t.league_info.has_yahoo_credentials ? "its own cookies" : `${providerLabel(t.league_info.provider)}, no credentials`}
                      </td>
                      <td className={s.tableMuted}>{writeSummary(t.capabilities)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Block>

      <Block title="How it fits">
        <div className={s.prose}>
          <p>
            <b>ESPN</b> has no sign-in for apps, so its two cookies stand in. They are checked against one of the account&apos;s private leagues, stored encrypted, and shared by every team on that account. When ESPN rotates them, the account shows as expired here and on the Week desk, and one paste fixes every team.
          </p>
          <p>
            {YAHOO_ENABLED ? (
              <>
                <b>Yahoo</b> signs you in itself. Court Vision holds read access there today, so a Yahoo team&apos;s week shows but its lineup is not sent.
              </>
            ) : (
              <>
                <b>Yahoo</b> is on its way. {YAHOO_SOON.replace("Yahoo is coming. ", "")}
              </>
            )}
          </p>
          <p>
            A team in a <b>public league</b> needs no account at all; it can be added by its league id.
          </p>
        </div>
      </Block>
    </div>
  );
}
