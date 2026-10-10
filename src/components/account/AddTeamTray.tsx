"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toApiError, userMessage } from "@/lib/api-error";
import {
  YAHOO_ENABLED,
  YAHOO_SOON,
  connectionLine,
  connectionState,
  connectionTitle,
  espnSeasonId,
  providerEnabled,
  seasonLabel,
  teamNamesFromMessage,
  usableConnections,
  type AddStep,
} from "@/lib/account";
import type { ProviderConnection } from "@/types/connections";
import type { FantasyProvider, LeagueInfoRequest, ScoringPreview } from "@/types/team";
import type { YahooLeague } from "@/types/yahoo";
import { AccountTeamList, Rows } from "./AccountTeams";
import { EspnConnectForm } from "./EspnConnectForm";
import type { AddTeamModel, AddedTeam } from "./model";
import { useNow } from "./blocks";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

/** Where the tray opens: the provider choice, or further along with what it needs. */
export interface AddStart {
  step: AddStep;
  /** The ESPN account whose teams to list, or the Yahoo connection to pick a league on. */
  connectionId?: number | null;
  /** Updating an account's cookies rather than adding a team: two columns, closes on success. */
  refresh?: boolean;
}

interface AddTeamTrayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: AddTeamModel;
  start: AddStart;
  /** Where the Yahoo callback should bring the browser back to. */
  returnTo: string;
  onAdded?: (added: AddedTeam) => void;
}

type TeamMode = "account" | "manual";

interface Flow {
  provider: FantasyProvider | null;
  connectionId: number | null;
  /** The account column shows the connect form. */
  connecting: boolean;
  /** No account: a public league by its id. */
  noAccount: boolean;
  mode: TeamMode;
}

function fromStart(start: AddStart, connections: readonly ProviderConnection[]): Flow {
  const espn = usableConnections(connections, "espn");
  const yahoo = usableConnections(connections, "yahoo");
  switch (start.step) {
    case "espn-connect":
      return { provider: "espn", connectionId: start.connectionId ?? null, connecting: true, noAccount: false, mode: "account" };
    case "espn-list":
      return { provider: "espn", connectionId: start.connectionId ?? espn[0]?.id ?? null, connecting: false, noAccount: false, mode: "account" };
    case "espn-manual":
      return { provider: "espn", connectionId: start.connectionId ?? espn[0]?.id ?? null, connecting: false, noAccount: !espn.length, mode: "manual" };
    case "yahoo-connect":
      return { provider: "yahoo", connectionId: null, connecting: true, noAccount: false, mode: "account" };
    case "yahoo-league":
    case "yahoo-team":
      return { provider: "yahoo", connectionId: start.connectionId ?? yahoo[0]?.id ?? null, connecting: false, noAccount: false, mode: "account" };
    default:
      return { provider: null, connectionId: null, connecting: false, noAccount: false, mode: "account" };
  }
}

const PREVIEWS: Array<{ id: ScoringPreview | ""; label: string }> = [
  { id: "", label: "As the league is" },
  { id: "points", label: "Points" },
  { id: "categories", label: "Categories" },
];

type ColState = "todo" | "active" | "done";

/**
 * Adding a team as a tray along the bottom of the desk: one column per step,
 * left to right. Provider, then the account it reads through (an account
 * already connected, new cookies, or none for a public league), then the
 * team (the account's own list, one click each, or a league id). Every
 * earlier column stays live, so a choice can be changed without starting
 * over. The same tray updates an account's cookies, in two columns.
 */
export function AddTeamTray({ open, onOpenChange, model, start, returnTo, onAdded }: AddTeamTrayProps) {
  const [flow, setFlow] = useState<Flow>(() => fromStart(start, model.connections));
  const [busy, setBusy] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [league, setLeague] = useState<YahooLeague | null>(null);
  const [nameChoices, setNameChoices] = useState<string[]>([]);
  // The manual form
  const [leagueId, setLeagueId] = useState("");
  const [year, setYear] = useState(() => String(espnSeasonId(model.seasonKey)));
  const [teamName, setTeamName] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [preview, setPreview] = useState<ScoringPreview | "">("");
  const [s2, setS2] = useState("");
  const [swid, setSwid] = useState("");
  const root = useRef<HTMLElement>(null);
  const now = useNow();

  // Each opening starts where it was asked to.
  const connectionsRef = useRef(model.connections);
  connectionsRef.current = model.connections;
  useEffect(() => {
    if (!open) return;
    setFlow(fromStart(start, connectionsRef.current));
    setBusy(null);
    setAccountError(null);
    setTeamError(null);
    setNote(null);
    setLeague(null);
    setNameChoices([]);
    setS2("");
    setSwid("");
    const t = setTimeout(() => root.current?.focus({ preventScroll: true }), 50);
    return () => clearTimeout(t);
  }, [open, start]);

  // Esc closes, from anywhere on the desk.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setS2("");
        setSwid("");
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onOpenChange]);

  const espnAccounts = useMemo(() => usableConnections(model.connections, "espn"), [model.connections]);
  const yahooAccounts = useMemo(() => usableConnections(model.connections, "yahoo"), [model.connections]);
  const accounts = flow.provider === "yahoo" ? yahooAccounts : espnAccounts;
  const account = flow.connectionId != null ? (model.connections.find((c) => c.id === flow.connectionId) ?? null) : null;
  const refresh = !!start.refresh;

  const teamReady = flow.provider != null && (account != null || flow.noAccount);
  const listId = open && flow.provider === "espn" && account && flow.mode === "account" ? account.id : null;
  const accountTeams = model.useAccountTeams(listId);
  const yahooLeagues = model.useYahooLeagues(open && flow.provider === "yahoo" && account ? account.id : null);
  const yahooTeams = model.useYahooTeams(open && flow.provider === "yahoo" && account && league ? account.id : null, league?.league_key ?? null);

  if (!open) return null;

  const close = () => {
    // Cookies typed for a public-league add never outlive the tray.
    setS2("");
    setSwid("");
    onOpenChange(false);
  };

  const pick = (provider: FantasyProvider) => {
    if (!providerEnabled(provider)) return;
    const usable = usableConnections(model.connections, provider);
    setAccountError(null);
    setTeamError(null);
    setNameChoices([]);
    setLeague(null);
    setFlow({ provider, connectionId: usable[0]?.id ?? null, connecting: usable.length === 0, noAccount: false, mode: "account" });
  };

  const chooseAccount = (id: number) => {
    setFlow((f) => ({ ...f, connectionId: id, connecting: false, noAccount: false }));
    setTeamError(null);
    setNameChoices([]);
    setLeague(null);
  };

  const add = async (key: string, body: LeagueInfoRequest) => {
    setBusy(key);
    setTeamError(null);
    setNameChoices([]);
    try {
      const added = await model.addTeam(body);
      onAdded?.(added);
      close();
    } catch (e) {
      const err = toApiError(e);
      const names = teamNamesFromMessage(err.message);
      if (names.length) {
        setNameChoices(names);
        setTeamError(`"${body.team_name}" is not a team in league ${body.league_id}. It is one of these:`);
      } else {
        setTeamError(userMessage(e, "The team was not added"));
      }
    } finally {
      setBusy(null);
    }
  };

  const addManual = (name = teamName) => {
    const id = Number(leagueId);
    if (!Number.isInteger(id) || id < 1) return setTeamError("The league id is the number in the league's ESPN URL.");
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2020 || y > 2030) return setTeamError("The season is ESPN's year for it: 2027 for 2026–27.");
    if (!name.trim()) return setTeamError("The team name, exactly as ESPN shows it.");
    const body: LeagueInfoRequest = {
      provider: "espn",
      league_id: id,
      year: y,
      team_name: name.trim(),
      league_name: leagueName.trim() || undefined,
      scoring_preview: preview || null,
    };
    if (account && !flow.noAccount) body.espn_connection_id = account.id;
    else {
      if (s2.trim()) body.espn_s2 = s2.trim();
      if (swid.trim()) body.swid = swid.trim();
    }
    void add("manual", body);
  };

  const startYahoo = async () => {
    setBusy("yahoo");
    setAccountError(null);
    try {
      await model.startYahoo(returnTo);
    } catch (e) {
      setAccountError(userMessage(e, "Yahoo's sign-in could not be started"));
      setBusy(null);
    }
  };

  const providerState: ColState = flow.provider ? "done" : "active";
  const accountState: ColState = !flow.provider ? "todo" : account || flow.noAccount ? "done" : "active";
  const teamState: ColState = teamReady ? "active" : "todo";

  const title = refresh ? "Update ESPN cookies" : "Add a team";
  const sub = refresh
    ? "New cookies for an account already connected; every team on it reads through them."
    : "Where the team lives, the account it reads through, then the team. Each column stays live.";

  return (
    <section ref={root} className={s.tray} role="dialog" aria-label={title} tabIndex={-1}>
      <div className={s.trayHead}>
        <span className={s.trayTitle}>{title}</span>
        <span className={s.traySub}>{sub}</span>
        <span className={dk.spacer} />
        <span className={dk.sub}>
          <span className={dk.kbd}>Esc</span> close
        </span>
        <button type="button" className={dk.iconBtn} onClick={close} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <div className={s.trayCols}>
        {/* ---------------------------------------------------------- 1 · provider */}
        <Column n={1} label="Provider" state={providerState} summary={flow.provider ? (flow.provider === "yahoo" ? "Yahoo" : "ESPN") : null}>
          {refresh ? (
            <div className={s.trayNote}>ESPN. An account&apos;s cookies are the only credential ESPN gives an app.</div>
          ) : (
            <div className={s.trayOptions}>
              <button type="button" className={s.trayOption} data-on={flow.provider === "espn" ? "true" : undefined} onClick={() => pick("espn")}>
                <span className={s.trayOptionTitle}>
                  ESPN
                  {flow.provider === "espn" ? <Check size={13} className={s.trayOptionCheck} /> : null}
                </span>
                <span className={s.trayOptionSub}>Lineups, adds and drops, scheduled pickups, draft sync. Cookies from a signed-in ESPN tab, once per account.</span>
                <span className={s.trayOptionNote}>{espnAccounts.length ? `${espnAccounts.map(connectionTitle).join(", ")} connected` : "No ESPN account connected yet"}</span>
              </button>
              <button
                type="button"
                className={s.trayOption}
                data-on={flow.provider === "yahoo" ? "true" : undefined}
                disabled={!YAHOO_ENABLED}
                aria-disabled={!YAHOO_ENABLED}
                onClick={() => pick("yahoo")}
              >
                <span className={s.trayOptionTitle}>
                  Yahoo
                  {!YAHOO_ENABLED ? <span className={`${dk.chip} ${dk.warnChip}`}>coming soon</span> : null}
                  {flow.provider === "yahoo" ? <Check size={13} className={s.trayOptionCheck} /> : null}
                </span>
                <span className={s.trayOptionSub}>{YAHOO_ENABLED ? "Sign in with Yahoo. Read-only until Yahoo grants Court Vision write access." : YAHOO_SOON}</span>
                {YAHOO_ENABLED ? <span className={s.trayOptionNote}>{yahooAccounts.length ? "Yahoo account connected" : "No Yahoo account connected yet"}</span> : null}
              </button>
            </div>
          )}
        </Column>

        {/* ---------------------------------------------------------- 2 · account */}
        <Column
          n={2}
          label="Account"
          state={accountState}
          summary={account ? connectionTitle(account) : flow.noAccount ? "None: a public league" : null}
        >
          {!flow.provider ? (
            <div className={s.trayNote}>Pick a provider first.</div>
          ) : flow.provider === "espn" ? (
            <div className={s.trayStack}>
              {accountError ? <div className={s.formError}>{accountError}</div> : null}
              {note ? (
                <div className={s.formNote} data-tone="ok">
                  {note}
                </div>
              ) : null}
              {refresh || flow.connecting || accounts.length === 0 ? (
                <EspnConnectForm
                  connect={model.connectEspn}
                  compact
                  refreshHint={refresh && account ? `New cookies for the ${connectionTitle(account)}. Paste the pair from the same ESPN account, or a different account becomes a second connection.` : null}
                  submitLabel={refresh ? "Check and update" : "Check and save"}
                  aside={
                    !refresh && accounts.length ? (
                      <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => setFlow((f) => ({ ...f, connecting: false }))}>
                        Use an account already connected
                      </button>
                    ) : undefined
                  }
                  onDone={(result) => {
                    if (refresh) {
                      close();
                      return;
                    }
                    setNote(result.message);
                    chooseAccount(result.connection.id);
                  }}
                />
              ) : (
                <>
                  <div className={s.trayOptions}>
                    {accounts.map((c) => {
                      const state = connectionState(c);
                      return (
                        <button key={c.id} type="button" className={s.trayOption} data-on={account?.id === c.id ? "true" : undefined} onClick={() => chooseAccount(c.id)}>
                          <span className={s.trayOptionTitle}>
                            <span className={s.dot} data-tone={state.tone === "ok" ? "ok" : state.tone === "warn" ? "warn" : undefined} />
                            {connectionTitle(c)}
                            {account?.id === c.id ? <Check size={13} className={s.trayOptionCheck} /> : null}
                          </span>
                          <span className={s.trayOptionNote}>
                            {state.label.toLowerCase()} · {connectionLine(c, now)} · {c.teams.length} {c.teams.length === 1 ? "team" : "teams"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className={s.row2}>
                    <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => setFlow((f) => ({ ...f, connecting: true }))}>
                      Another ESPN account
                    </button>
                    <button
                      type="button"
                      className={`${dk.btn} ${dk.btnSmall} ${flow.noAccount ? dk.toggleOn : ""}`}
                      aria-pressed={flow.noAccount}
                      onClick={() => {
                        setFlow((f) => ({ ...f, connectionId: null, noAccount: true, mode: "manual" }));
                        setTeamError(null);
                      }}
                    >
                      None: a public league
                    </button>
                  </div>
                </>
              )}
              {flow.noAccount ? <div className={s.trayNote}>No credentials: ESPN answers for a public league without any. A private league needs an account.</div> : null}
            </div>
          ) : !YAHOO_ENABLED ? (
            <div className={s.formNote} data-tone="warn">
              {YAHOO_SOON}
            </div>
          ) : (
            <div className={s.trayStack}>
              {accountError ? <div className={s.formError}>{accountError}</div> : null}
              {accounts.length ? (
                <div className={s.trayOptions}>
                  {accounts.map((c) => (
                    <button key={c.id} type="button" className={s.trayOption} data-on={account?.id === c.id ? "true" : undefined} onClick={() => chooseAccount(c.id)}>
                      <span className={s.trayOptionTitle}>
                        {connectionTitle(c)}
                        {account?.id === c.id ? <Check size={13} className={s.trayOptionCheck} /> : null}
                      </span>
                      <span className={s.trayOptionNote}>
                        {connectionState(c).label.toLowerCase()} · {c.teams.length} {c.teams.length === 1 ? "team" : "teams"}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className={s.trayNote}>You will leave for Yahoo&apos;s sign-in and come straight back here. Yahoo keys the connection to its account, so signing in again refreshes it rather than adding a second one.</div>
              <div className={s.row2}>
                <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} disabled={busy != null} onClick={() => void startYahoo()}>
                  {busy === "yahoo" ? <Loader2 size={13} className={dk.spin} /> : null} {accounts.length ? "Sign in again" : "Continue with Yahoo"}
                </button>
              </div>
            </div>
          )}
        </Column>

        {/* ---------------------------------------------------------- 3 · team */}
        {!refresh ? (
          <Column
            n={3}
            label="Team"
            state={teamState}
            right={
              flow.provider === "espn" && teamReady && !flow.noAccount ? (
                <div className={s.miniRail}>
                  {(["account", "manual"] as const).map((m) => (
                    <button key={m} type="button" className={`${s.miniSeg} ${flow.mode === m ? s.miniSegOn : ""}`} onClick={() => setFlow((f) => ({ ...f, mode: m }))}>
                      {m === "account" ? "From the account" : "By league id"}
                    </button>
                  ))}
                </div>
              ) : undefined
            }
          >
            {!teamReady ? (
              <div className={s.trayNote}>{flow.provider ? "Pick an account first." : "Pick a provider first."}</div>
            ) : flow.provider === "espn" && flow.mode === "account" && account ? (
              <div className={s.trayStack}>
                {teamError ? <div className={s.formError}>{teamError}</div> : null}
                <AccountTeamList
                  loading={accountTeams.loading}
                  error={accountTeams.error}
                  teams={accountTeams.data ?? []}
                  busy={busy}
                  onAdd={(t) =>
                    void add(`espn:${t.league_id}:${t.espn_team_id}`, {
                      provider: "espn",
                      league_id: t.league_id,
                      team_name: t.team_name,
                      league_name: t.league_name ?? undefined,
                      year: t.season,
                      espn_connection_id: account.id,
                    })
                  }
                  onTracked={(teamId) => {
                    onAdded?.({ teamId, alreadyExists: true, team: null });
                    close();
                  }}
                />
                <span className={s.fieldHint}>As ESPN lists them on the account. Not listed? Switch to a league id above.</span>
              </div>
            ) : flow.provider === "espn" ? (
              <div className={s.trayStack}>
                <div className={s.form}>
                  <label className={s.field}>
                    <span className={s.fieldLabel}>League id</span>
                    <input className={dk.input} inputMode="numeric" value={leagueId} placeholder="993431466" onChange={(e) => setLeagueId(e.target.value.trim())} />
                  </label>
                  <label className={s.field}>
                    <span className={s.fieldLabel}>Season</span>
                    <input className={dk.input} inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.trim())} />
                  </label>
                  <label className={`${s.field} ${s.formFull}`}>
                    <span className={s.fieldLabel}>Team name</span>
                    <input className={dk.input} value={teamName} placeholder="Exactly as ESPN shows it" onChange={(e) => setTeamName(e.target.value)} />
                  </label>
                  <label className={s.field}>
                    <span className={s.fieldLabel}>
                      League name <em style={{ fontStyle: "normal", color: "var(--text-3)" }}>optional</em>
                    </span>
                    <input className={dk.input} value={leagueName} onChange={(e) => setLeagueName(e.target.value)} />
                  </label>
                  <label className={s.field}>
                    <span className={s.fieldLabel}>Show as</span>
                    <select className={s.select} value={preview} onChange={(e) => setPreview(e.target.value as ScoringPreview | "")}>
                      {PREVIEWS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {flow.noAccount || !account ? (
                    <>
                      <label className={s.field}>
                        <span className={s.fieldLabel}>
                          espn_s2 <em style={{ fontStyle: "normal", color: "var(--text-3)" }}>private leagues</em>
                        </span>
                        <input className={dk.input} value={s2} spellCheck={false} autoComplete="off" onChange={(e) => setS2(e.target.value)} />
                      </label>
                      <label className={s.field}>
                        <span className={s.fieldLabel}>SWID</span>
                        <input className={dk.input} value={swid} placeholder="{…}" spellCheck={false} autoComplete="off" onChange={(e) => setSwid(e.target.value)} />
                      </label>
                    </>
                  ) : null}
                </div>
                <span className={s.fieldHint}>
                  The league id is the number after leagueId= in the league&apos;s ESPN URL. The season is ESPN&apos;s year for it: {espnSeasonId(model.seasonKey)} is {seasonLabel("espn", espnSeasonId(model.seasonKey))}.
                  {account && !flow.noAccount ? ` Reads through the ${connectionTitle(account)}.` : ""}
                </span>
                {teamError ? (
                  <div className={s.formError}>
                    {teamError}
                    {nameChoices.length ? (
                      <div className={s.row2} style={{ marginTop: 8 }}>
                        {nameChoices.map((n) => (
                          <button
                            key={n}
                            type="button"
                            className={`${dk.btn} ${dk.btnSmall}`}
                            disabled={busy != null}
                            onClick={() => {
                              setTeamName(n);
                              addManual(n);
                            }}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className={s.row2}>
                  <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} disabled={busy != null} onClick={() => addManual()}>
                    {busy === "manual" ? <Loader2 size={13} className={dk.spin} /> : null} Add team
                  </button>
                </div>
              </div>
            ) : !league ? (
              <div className={s.trayStack}>
                {teamError ? <div className={s.formError}>{teamError}</div> : null}
                {yahooLeagues.loading ? (
                  <Rows n={3} />
                ) : yahooLeagues.error ? (
                  <div className={s.formError}>{yahooLeagues.error}</div>
                ) : (
                  <div className={s.list}>
                    {(yahooLeagues.data ?? []).map((l) => (
                      <button
                        key={l.league_key}
                        type="button"
                        className={s.item}
                        onClick={() => {
                          setLeague(l);
                          setTeamError(null);
                        }}
                      >
                        <span className={s.itemBody}>
                          <span className={s.itemName}>
                            <span>{l.name}</span>
                          </span>
                          <span className={s.itemSub}>{[`${l.num_teams} teams`, yahooFormat(l.scoring_type), seasonLabel("yahoo", Number(l.season)) ?? l.season].filter(Boolean).join(" · ")}</span>
                        </span>
                        <span className={s.itemRight}>
                          <span className={dk.sub}>choose</span>
                        </span>
                      </button>
                    ))}
                    {(yahooLeagues.data ?? []).length === 0 ? <div className={s.listEmpty}>Yahoo lists no basketball league on this account.</div> : null}
                  </div>
                )}
                <span className={s.fieldHint}>Your basketball leagues on the Yahoo account. Pick one, then the team that is yours.</span>
              </div>
            ) : (
              <div className={s.trayStack}>
                <div className={s.row2}>
                  <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => setLeague(null)}>
                    ← Leagues
                  </button>
                  <span className={dk.sub}>
                    {league.name} · {league.num_teams} teams
                  </span>
                </div>
                {teamError ? <div className={s.formError}>{teamError}</div> : null}
                {yahooTeams.loading ? (
                  <Rows n={4} />
                ) : yahooTeams.error ? (
                  <div className={s.formError}>{yahooTeams.error}</div>
                ) : (
                  <div className={s.list}>
                    {[...(yahooTeams.data ?? [])]
                      .sort((a, b) => Number(b.is_owned_by_current_login) - Number(a.is_owned_by_current_login))
                      .map((t) => {
                        const key = `yahoo:${t.team_key}`;
                        return (
                          <button
                            key={t.team_key}
                            type="button"
                            className={s.item}
                            data-on={t.is_owned_by_current_login ? "true" : undefined}
                            disabled={busy != null}
                            onClick={() =>
                              void add(key, {
                                provider: "yahoo",
                                league_id: Number(league.league_id),
                                team_name: t.name,
                                league_name: league.name,
                                year: Number(league.season),
                                yahoo_connection_id: account?.id,
                                yahoo_team_key: t.team_key,
                              })
                            }
                          >
                            <span className={s.itemBody}>
                              <span className={s.itemName}>
                                <span>{t.name}</span>
                                {t.is_owned_by_current_login ? <span className={`${dk.chip} ${dk.up}`}>yours</span> : null}
                              </span>
                              <span className={s.itemSub}>team {t.team_id}</span>
                            </span>
                            <span className={s.itemRight}>{busy === key ? <Loader2 size={13} className={dk.spin} /> : <span className={`${dk.btn} ${dk.btnSmall}`}>Add</span>}</span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </Column>
        ) : null}
      </div>
    </section>
  );
}

function Column({ n, label, state, summary, right, children }: { n: number; label: string; state: ColState; summary?: string | null; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={s.trayCol} data-state={state}>
      <div className={s.trayColHead}>
        <span className={s.trayStep}>{state === "done" ? <Check size={11} /> : n}</span>
        <span className={s.trayColLabel}>{label}</span>
        {summary ? <span className={s.trayColSummary}>{summary}</span> : null}
        {right ? <span className={s.trayColRight}>{right}</span> : null}
      </div>
      <div className={s.trayColBody}>{children}</div>
    </div>
  );
}

function yahooFormat(raw: string): string | null {
  const key = raw.toLowerCase();
  if (key === "head") return "H2H categories";
  if (key === "headpoint") return "H2H points";
  if (key === "headone") return "H2H one win";
  if (key === "point") return "Points";
  if (key === "roto") return "Roto";
  return raw || null;
}
