"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { DeskDialog } from "@/components/desk/DeskDialog";
import { userMessage, toApiError } from "@/lib/api-error";
import {
  accountTeamLine,
  connectionTitle,
  espnSeasonId,
  firstStep,
  providerLabel,
  seasonLabel,
  sortAccountTeams,
  teamNamesFromMessage,
  usableConnections,
  type AddStep,
} from "@/lib/account";
import type { FantasyProvider, LeagueInfoRequest, ScoringPreview } from "@/types/team";
import type { YahooLeague } from "@/types/yahoo";
import { EspnConnectForm } from "./EspnConnectForm";
import type { AddTeamModel, AddedTeam } from "./model";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

/** Where the dialog opens: the provider choice, or a later step with what it needs. */
export interface AddStart {
  step: AddStep;
  /** The ESPN account whose teams to list, or the Yahoo connection to pick a league on. */
  connectionId?: number | null;
  /** Updating an account's cookies rather than adding a team: closes on success. */
  refresh?: boolean;
}

interface AddTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: AddTeamModel;
  start: AddStart;
  /** Where the Yahoo callback should bring the browser back to. */
  returnTo: string;
  onAdded?: (added: AddedTeam) => void;
}

const PREVIEWS: Array<{ id: ScoringPreview | ""; label: string }> = [
  { id: "", label: "As the league is" },
  { id: "points", label: "Points" },
  { id: "categories", label: "Categories" },
];

/**
 * Adding a team, step by step: which provider; for ESPN the account's own
 * list once an account is connected (one click adds), the cookies when none
 * is, and a league id for a public league; for Yahoo the sign-in, then a
 * league, then a team. The same dialog updates an account's cookies.
 */
export function AddTeamDialog({ open, onOpenChange, model, start, returnTo, onAdded }: AddTeamDialogProps) {
  const [step, setStep] = useState<AddStep>(start.step);
  const [connectionId, setConnectionId] = useState<number | null>(start.connectionId ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [league, setLeague] = useState<YahooLeague | null>(null);
  // The manual form
  const [leagueId, setLeagueId] = useState("");
  const [year, setYear] = useState(() => String(espnSeasonId(model.seasonKey)));
  const [teamName, setTeamName] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [preview, setPreview] = useState<ScoringPreview | "">("");
  const [s2, setS2] = useState("");
  const [swid, setSwid] = useState("");
  const [nameChoices, setNameChoices] = useState<string[]>([]);

  // Each opening starts where it was asked to.
  useEffect(() => {
    if (!open) return;
    setStep(start.step);
    setConnectionId(start.connectionId ?? null);
    setError(null);
    setNote(null);
    setBusy(null);
    setLeague(null);
    setNameChoices([]);
  }, [open, start]);

  const espnAccounts = useMemo(() => usableConnections(model.connections, "espn"), [model.connections]);
  const yahooAccounts = useMemo(() => usableConnections(model.connections, "yahoo"), [model.connections]);
  const espnId = step === "espn-list" || step === "espn-manual" ? (connectionId ?? espnAccounts[0]?.id ?? null) : null;
  const yahooId = step === "yahoo-league" || step === "yahoo-team" ? (connectionId ?? yahooAccounts[0]?.id ?? null) : null;

  const accountTeams = model.useAccountTeams(step === "espn-list" ? espnId : null);
  const yahooLeagues = model.useYahooLeagues(step === "yahoo-league" ? yahooId : null);
  const yahooTeams = model.useYahooTeams(step === "yahoo-team" ? yahooId : null, step === "yahoo-team" ? (league?.league_key ?? null) : null);

  const pick = (provider: FantasyProvider) => {
    setError(null);
    setStep(firstStep(provider, model.connections));
  };

  const add = async (key: string, body: LeagueInfoRequest) => {
    setBusy(key);
    setError(null);
    setNameChoices([]);
    try {
      const added = await model.addTeam(body);
      onAdded?.(added);
      onOpenChange(false);
    } catch (e) {
      const err = toApiError(e);
      const names = teamNamesFromMessage(err.message);
      if (names.length) {
        setNameChoices(names);
        setError(`"${body.team_name}" is not a team in league ${body.league_id}. It is one of these:`);
      } else {
        setError(userMessage(e, "The team was not added"));
      }
    } finally {
      setBusy(null);
    }
  };

  const addManual = (name = teamName) => {
    const id = Number(leagueId);
    if (!Number.isInteger(id) || id < 1) return setError("The league id is the number in the league's ESPN URL.");
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2020 || y > 2030) return setError("The season is ESPN's year for it: 2027 for 2026–27.");
    if (!name.trim()) return setError("The team name, exactly as ESPN shows it.");
    const body: LeagueInfoRequest = {
      provider: "espn",
      league_id: id,
      year: y,
      team_name: name.trim(),
      league_name: leagueName.trim() || undefined,
      scoring_preview: preview || null,
    };
    if (espnId != null) body.espn_connection_id = espnId;
    else {
      if (s2.trim()) body.espn_s2 = s2.trim();
      if (swid.trim()) body.swid = swid.trim();
    }
    void add("manual", body);
  };

  const startYahoo = async () => {
    setBusy("yahoo");
    setError(null);
    try {
      await model.startYahoo(returnTo);
    } catch (e) {
      setError(userMessage(e, "Yahoo's sign-in could not be started"));
      setBusy(null);
    }
  };

  const back = () => {
    setError(null);
    setNameChoices([]);
    if (step === "yahoo-team") return setStep("yahoo-league");
    if (step === "espn-manual") return setStep(espnAccounts.length ? "espn-list" : "espn-connect");
    setStep("provider");
  };

  const title =
    start.refresh ? "Update ESPN cookies"
    : step === "provider" ? "Add a team"
    : step === "espn-connect" ? "Connect an ESPN account"
    : step === "espn-list" ? "Your teams on ESPN"
    : step === "espn-manual" ? "Add an ESPN team by league id"
    : step === "yahoo-connect" ? "Connect Yahoo"
    : step === "yahoo-league" ? "Which league?"
    : "Which team is yours?";

  const description =
    step === "provider" ? "Where the team lives. An account is connected once; every team on it reads through it."
    : step === "espn-connect" && !start.refresh ? "ESPN has no sign-in for apps, so its two cookies stand in. Once they are saved, every team on the account can be added with a click."
    : step === "espn-list" ? "As ESPN lists them on the account. One click adds a team; the rest stay where they are."
    : step === "espn-manual" ? "For a public league, or one ESPN does not list on a connected account."
    : step === "yahoo-connect" ? "Yahoo signs you in itself and comes back here. Court Vision holds read access on Yahoo today, so lineups show but are not sent."
    : step === "yahoo-league" ? "Your basketball leagues on the Yahoo account."
    : step === "yahoo-team" && league ? `${league.name} · ${league.num_teams} teams · ${seasonLabel("yahoo", Number(league.season)) ?? league.season}`
    : undefined;

  const footer = step === "provider" ? undefined : (
    <>
      {!start.refresh ? (
        <button type="button" className={dk.btn} onClick={back}>
          <ArrowLeft size={13} /> Back
        </button>
      ) : null}
      {step === "espn-manual" ? (
        <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} disabled={busy != null} onClick={() => addManual()}>
          {busy === "manual" ? <Loader2 size={13} className={dk.spin} /> : null} Add team
        </button>
      ) : null}
      {step === "yahoo-connect" ? (
        <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} disabled={busy != null} onClick={() => void startYahoo()}>
          {busy === "yahoo" ? <Loader2 size={13} className={dk.spin} /> : null} Continue with Yahoo
        </button>
      ) : null}
    </>
  );

  return (
    <DeskDialog open={open} onOpenChange={onOpenChange} title={title} description={description} wide footer={footer} cancelLabel={step === "provider" ? "Cancel" : "Close"}>
      {step === "provider" ? (
        <div className={s.choices}>
          <button type="button" className={s.choice} onClick={() => pick("espn")}>
            <span className={s.choiceTitle}>ESPN</span>
            <span className={s.choiceSub}>Lineups, adds and drops, scheduled pickups, draft sync. Cookies from a signed-in ESPN tab, once per account.</span>
            <span className={s.choiceNote}>{espnAccounts.length ? `${espnAccounts.map(connectionTitle).join(", ")} connected` : "No ESPN account connected yet"}</span>
          </button>
          <button type="button" className={s.choice} onClick={() => pick("yahoo")}>
            <span className={s.choiceTitle}>Yahoo</span>
            <span className={s.choiceSub}>Sign in with Yahoo. Read-only until Yahoo grants Court Vision write access.</span>
            <span className={s.choiceNote}>{yahooAccounts.length ? "Yahoo account connected" : "No Yahoo account connected yet"}</span>
          </button>
        </div>
      ) : null}

      {step === "espn-connect" ? (
        <EspnConnectForm
          connect={model.connectEspn}
          refreshHint={start.refresh && connectionId != null ? `New cookies for the ${connectionTitle(model.connections.find((c) => c.id === connectionId) ?? { provider: "espn", account_hint: null })}. Paste the pair from the same ESPN account, or a different account becomes a second connection.` : null}
          submitLabel={start.refresh ? "Check and update" : "Check and save"}
          aside={
            !start.refresh ? (
              <button type="button" className={dk.btn} onClick={() => setStep("espn-manual")}>
                Public league? Add by league id
              </button>
            ) : undefined
          }
          onDone={(result) => {
            if (start.refresh) {
              onOpenChange(false);
              return;
            }
            setConnectionId(result.connection.id);
            setNote(result.message);
            setStep("espn-list");
          }}
        />
      ) : null}

      {step === "espn-list" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {note ? <div className={s.formNote} data-tone="ok">{note}</div> : null}
          {espnAccounts.length > 1 ? (
            <label className={s.field}>
              <span className={s.fieldLabel}>Account</span>
              <select className={s.select} value={espnId ?? ""} onChange={(e) => setConnectionId(Number(e.target.value))}>
                {espnAccounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {connectionTitle(c)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {error ? <div className={s.formError}>{error}</div> : null}
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
                espn_connection_id: espnId ?? undefined,
              })
            }
            onTracked={(teamId) => {
              onAdded?.({ teamId, alreadyExists: true, team: null });
              onOpenChange(false);
            }}
          />
          <div className={s.row2}>
            <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => setStep("espn-manual")}>
              Not listed? Add by league id
            </button>
            <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => setStep("espn-connect")}>
              Another ESPN account
            </button>
          </div>
        </div>
      ) : null}

      {step === "espn-manual" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className={s.form}>
            <label className={s.field}>
              <span className={s.fieldLabel}>League id</span>
              <input className={dk.input} inputMode="numeric" value={leagueId} placeholder="993431466" onChange={(e) => setLeagueId(e.target.value.trim())} />
              <span className={s.fieldHint}>The number in the league&apos;s ESPN URL, after leagueId=.</span>
            </label>
            <label className={s.field}>
              <span className={s.fieldLabel}>Season</span>
              <input className={dk.input} inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.trim())} />
              <span className={s.fieldHint}>ESPN&apos;s year for it: {espnSeasonId(model.seasonKey)} is {seasonLabel("espn", espnSeasonId(model.seasonKey))}.</span>
            </label>
            <label className={`${s.field} ${s.formFull}`}>
              <span className={s.fieldLabel}>Team name</span>
              <input className={dk.input} value={teamName} placeholder="Exactly as ESPN shows it" onChange={(e) => setTeamName(e.target.value)} />
            </label>
            <label className={s.field}>
              <span className={s.fieldLabel}>League name <em style={{ fontStyle: "normal", color: "var(--text-3)" }}>optional</em></span>
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
            {espnId == null ? (
              <>
                <label className={s.field}>
                  <span className={s.fieldLabel}>espn_s2 <em style={{ fontStyle: "normal", color: "var(--text-3)" }}>private leagues</em></span>
                  <input className={dk.input} value={s2} spellCheck={false} autoComplete="off" onChange={(e) => setS2(e.target.value)} />
                </label>
                <label className={s.field}>
                  <span className={s.fieldLabel}>SWID</span>
                  <input className={dk.input} value={swid} placeholder="{…}" spellCheck={false} autoComplete="off" onChange={(e) => setSwid(e.target.value)} />
                </label>
              </>
            ) : (
              <span className={`${s.fieldHint} ${s.formFull}`}>Reads through the {connectionTitle(espnAccounts.find((c) => c.id === espnId) ?? espnAccounts[0])}.</span>
            )}
          </div>
          {error ? (
            <div className={s.formError}>
              {error}
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
        </div>
      ) : null}

      {step === "yahoo-connect" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className={s.prose}>
            <p>You will leave for Yahoo&apos;s sign-in and come straight back here to pick the league and the team.</p>
            <p>Yahoo keys the connection to its account, so connecting again later refreshes it rather than adding a second one.</p>
          </div>
          {error ? <div className={s.formError}>{error}</div> : null}
        </div>
      ) : null}

      {step === "yahoo-league" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {yahooAccounts.length === 0 && yahooId == null ? <div className={s.formError}>No Yahoo account is connected. Go back and connect one.</div> : null}
          {error ? <div className={s.formError}>{error}</div> : null}
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
                    setError(null);
                    setStep("yahoo-team");
                  }}
                >
                  <span className={s.itemBody}>
                    <span className={s.itemName}>
                      <span>{l.name}</span>
                    </span>
                    <span className={s.itemSub}>
                      {[`${l.num_teams} teams`, yahooFormat(l.scoring_type), seasonLabel("yahoo", Number(l.season)) ?? l.season].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className={s.itemRight}>
                    <span className={dk.sub}>choose</span>
                  </span>
                </button>
              ))}
              {(yahooLeagues.data ?? []).length === 0 ? <div className={s.listEmpty}>Yahoo lists no basketball league on this account.</div> : null}
            </div>
          )}
        </div>
      ) : null}

      {step === "yahoo-team" && league ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {error ? <div className={s.formError}>{error}</div> : null}
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
                          yahoo_connection_id: yahooId ?? undefined,
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
                      <span className={s.itemRight}>
                        {busy === key ? <Loader2 size={13} className={dk.spin} /> : <span className={`${dk.btn} ${dk.btnSmall}`}>Add</span>}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      ) : null}
    </DeskDialog>
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

function Rows({ n }: { n: number }) {
  return (
    <div className={s.ledgerSkel} style={{ padding: "4px 0" }} aria-busy>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={dk.skel} style={{ width: `${88 - i * 9}%` }} />
      ))}
    </div>
  );
}

/** The teams ESPN lists on a connected account: one click adds; the tracked ones open instead. */
export function AccountTeamList({
  loading,
  error,
  teams,
  busy,
  onAdd,
  onTracked,
  only,
}: {
  loading: boolean;
  error: string | null;
  teams: readonly import("@/types/connections").EspnAccountTeam[];
  busy: string | null;
  onAdd: (t: import("@/types/connections").EspnAccountTeam) => void;
  onTracked?: (teamId: number) => void;
  /** Leave out the teams already tracked. */
  only?: "untracked";
}) {
  if (loading) return <Rows n={4} />;
  if (error) return <div className={s.formError}>{error}</div>;
  const rows = sortAccountTeams(teams).filter((t) => only !== "untracked" || t.tracked_team_id == null);
  return (
    <div className={s.list}>
      {rows.map((t) => {
        const key = `espn:${t.league_id}:${t.espn_team_id}`;
        const tracked = t.tracked_team_id != null;
        return (
          <button
            key={`${t.league_id}:${t.espn_team_id}:${t.season}`}
            type="button"
            className={s.item}
            disabled={busy != null || (tracked && !onTracked)}
            onClick={() => (tracked ? onTracked?.(t.tracked_team_id!) : onAdd(t))}
          >
            <span className={s.itemBody}>
              <span className={s.itemName}>
                <span>{t.team_name}</span>
                {t.team_abbrev ? <span className={dk.sub}>{t.team_abbrev}</span> : null}
              </span>
              <span className={s.itemSub}>{accountTeamLine(t)}</span>
            </span>
            <span className={s.itemRight}>
              {busy === key ? (
                <Loader2 size={13} className={dk.spin} />
              ) : tracked ? (
                <span className={`${dk.chip} ${dk.flat}`}>
                  <Check size={11} /> tracked
                </span>
              ) : (
                <span className={`${dk.btn} ${dk.btnSmall}`}>Add</span>
              )}
            </span>
          </button>
        );
      })}
      {rows.length === 0 ? (
        <div className={s.listEmpty}>
          {only === "untracked" ? "Every basketball team ESPN lists on this account is already here." : "ESPN lists no basketball team on this account. A league it does not list can be added by its id."}
        </div>
      ) : null}
    </div>
  );
}

export { providerLabel };
