"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Loader2, Minus, RefreshCw, Trash2 } from "lucide-react";
import { DeskDialog } from "@/components/desk/DeskDialog";
import { polarityGlyph, statLabel, winModeLabel } from "@/lib/category-format";
import { userMessage } from "@/lib/api-error";
import {
  capabilityRows,
  connectionLine,
  connectionState,
  connectionTitle,
  formatLabel,
  providerLabel,
  seasonLabel,
  teamCredentials,
  teamLine,
  teamName,
  usableConnections,
  writeSummary,
  type AccountFocus,
} from "@/lib/account";
import type { LeagueDetail, ScoringPreview, TeamResponseData } from "@/types/team";
import type { AccountModel } from "./model";
import { Block, Facts, Skeleton, ago, useNow } from "./blocks";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

interface TeamSheetProps {
  model: AccountModel;
  team: TeamResponseData;
  alerts: { on: boolean | null; custom: boolean } | null;
  onOpen: (focus: AccountFocus) => void;
  onRemoved: () => void;
}

const PREVIEWS: Array<{ id: ScoringPreview | ""; label: string; help: string }> = [
  { id: "", label: "As the league is", help: "the format the provider reports" },
  { id: "points", label: "Points", help: "score it as a points league" },
  { id: "categories", label: "Categories", help: "score it as a 9-cat league" },
];

/** One team: its league as synced, the account it reads through, what can be sent, and the ways out. */
export function TeamSheet({ model, team, alerts, onOpen, onRemoved }: TeamSheetProps) {
  const now = useNow();
  const league = model.useLeague(team.team_id);
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkTo, setLinkTo] = useState<number | "">("");

  const info = team.league_info;
  const creds = teamCredentials(team, model.connections);
  const accounts = usableConnections(model.connections, info.provider);
  const selected = team.team_id === model.selectedTeamId;
  const preview = (info.scoring_preview ?? "") as ScoringPreview | "";

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await model.removeTeam(team.team_id);
      setConfirm(false);
      onRemoved();
    } catch (e) {
      setError(userMessage(e, "The team was not removed"));
      setConfirm(false);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <span className={s.headTitle}>{teamName(team)}</span>
          <span className={s.headSub}>{teamLine(team)}</span>
          <span className={s.headChips}>
            <span className={`${dk.chip} ${dk.flat}`}>{providerLabel(info.provider)}</span>
            <span className={`${dk.chip} ${team.league?.settings_synced ? dk.pv : dk.flat}`}>{formatLabel(team.league)}</span>
            <span className={`${dk.chip} ${team.capabilities?.lineup_write ? dk.up : dk.flat}`}>{writeSummary(team.capabilities)}</span>
            {creds.kind === "connection" && creds.connection.status === "expired" ? <span className={`${dk.chip} ${dk.warnChip}`}>account expired</span> : null}
            {selected ? <span className={`${dk.chip} ${dk.flat}`}>on the Week desk</span> : null}
          </span>
        </div>
        <div className={s.headActions}>
          {selected ? (
            <Link href="/week" className={`${dk.btn} ${dk.btnPrimary}`}>
              Open the week
            </Link>
          ) : (
            <button
              type="button"
              className={`${dk.btn} ${dk.btnPrimary}`}
              onClick={() => model.selectTeam(team.team_id)}
              title="Make this the team the Week and Draft desks work on"
            >
              Use on the desks
            </button>
          )}
          <button type="button" className={dk.btn} disabled={model.syncing === team.team_id} onClick={() => void run("sync", () => model.syncLeague(team.team_id))}>
            {model.syncing === team.team_id ? <Loader2 size={13} className={dk.spin} /> : <RefreshCw size={13} />}
            {team.league?.settings_synced ? "Re-sync" : "Sync settings"}
          </button>
          <button type="button" className={`${dk.btn} ${dk.btnDanger}`} onClick={() => setConfirm(true)}>
            <Trash2 size={13} /> Remove
          </button>
        </div>
      </header>

      {error ? (
        <div className={s.block}>
          <div className={s.formError}>{error}</div>
        </div>
      ) : null}

      <Block
        title="League settings"
        note={league.data?.settings_synced ? `synced ${ago(league.data.settings_synced_at, now)}` : team.league ? "not synced" : undefined}
      >
        {league.loading ? (
          <Skeleton rows={4} />
        ) : league.error ? (
          <div className={s.formError}>{league.error}</div>
        ) : !league.data || !league.data.settings_synced ? (
          <div className={s.prose}>
            <p>
              The league&apos;s scoring has not been read from {providerLabel(info.provider)} yet, so this team is scored as a points league. Sync to find out whether it is points or categories; matchups, rankings and the Week desk follow.
            </p>
          </div>
        ) : (
          <LeagueFacts league={league.data} />
        )}
      </Block>

      <Block title="Show as" note="how this team is scored on the desks">
        <div className={dk.rail} style={{ display: "inline-flex" }}>
          {PREVIEWS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`${dk.seg} ${preview === p.id ? dk.segOn : ""}`}
              disabled={busy === "preview"}
              title={p.help}
              onClick={() => (preview === p.id ? undefined : void run("preview", () => model.setPreview(team, p.id || null)))}
            >
              {preview === p.id ? <span className={dk.segPill} /> : null}
              <span className={dk.segLabel}>{p.label}</span>
            </button>
          ))}
        </div>
        <div className={s.fieldHint} style={{ marginTop: 8 }}>
          {preview ? `Shown as a ${preview} league whatever the provider reports; the real settings stay synced underneath.` : "The format the league's synced settings report."}
        </div>
      </Block>

      <Block title="Account" note={creds.kind === "connection" ? connectionState(creds.connection).label.toLowerCase() : creds.kind === "inline" ? "cookies on the team" : "none"}>
        {creds.kind === "connection" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" className={s.item} style={{ borderRadius: 8, border: "1px solid var(--line)" }} onClick={() => onOpen({ kind: "connection", id: creds.connection.id })}>
              <span className={s.itemBody}>
                <span className={s.itemName}>
                  <span className={s.dot} data-tone={connectionState(creds.connection).tone === "ok" ? "ok" : connectionState(creds.connection).tone === "warn" ? "warn" : undefined} />
                  <span>{connectionTitle(creds.connection)}</span>
                </span>
                <span className={s.itemSub}>
                  {connectionState(creds.connection).label.toLowerCase()} · {connectionLine(creds.connection, now)} · {creds.connection.teams.length} {creds.connection.teams.length === 1 ? "team" : "teams"}
                </span>
              </span>
              <span className={s.itemRight}>
                <span className={dk.sub}>open</span>
              </span>
            </button>
            {creds.connection.status === "expired" ? (
              <div className={s.formNote} data-tone="warn">
                {providerLabel(creds.connection.provider)} rejected this account&apos;s credentials, so reads for this team fail until they are updated. Open the account to paste new cookies.
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className={s.prose}>
              {creds.kind === "inline" ? (
                <p>
                  This team carries its own {providerLabel(info.provider)} credentials from before accounts existed. Linking it to a connected account means one set of cookies for every team, refreshed in one place.
                </p>
              ) : (
                <p>
                  No credentials. {providerLabel(info.provider)} answers for a public league without any; a private league refuses. Link a connected account to read it.
                </p>
              )}
            </div>
            {accounts.length ? (
              <div className={s.row2}>
                <select className={s.select} value={linkTo} onChange={(e) => setLinkTo(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Choose an account…</option>
                  {accounts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {connectionTitle(c)}
                    </option>
                  ))}
                </select>
                <button type="button" className={dk.btn} disabled={linkTo === "" || busy === "link"} onClick={() => void run("link", () => model.linkTeam(team, linkTo as number))}>
                  {busy === "link" ? <Loader2 size={13} className={dk.spin} /> : null} Link
                </button>
              </div>
            ) : (
              <span className={s.fieldHint}>No {providerLabel(info.provider)} account is connected; connect one from the ledger and it can be linked here.</span>
            )}
          </div>
        )}
      </Block>

      <Block title="What Court Vision can do here" note={writeSummary(team.capabilities)}>
        <div className={s.caps}>
          {capabilityRows(team.capabilities).map((c) => (
            <div key={c.key} className={s.cap} data-on={c.on ? "true" : "false"}>
              <span className={s.capMark}>{c.on ? <Check size={13} /> : <Minus size={13} />}</span>
              <span>{c.label}</span>
              <span className={s.capNote}>{c.note}</span>
            </div>
          ))}
        </div>
      </Block>

      <Block title="Lineup alerts" note={alerts ? (alerts.custom ? "custom for this team" : "the account's settings") : undefined}>
        <div className={s.row2}>
          <span className={s.prose}>
            {alerts == null ? "Alerts before tip-off, set for the account or for this team alone." : alerts.on ? "An email before the first tip-off when a starter is out or benched." : "Off for this team."}
          </span>
          <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => onOpen({ kind: "alerts" })}>
            Open alerts
          </button>
        </div>
      </Block>

      <DeskDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Remove ${teamName(team)}?`}
        description={`Court Vision stops following it: its week, lineups and scheduled pickups go. Nothing changes on ${providerLabel(info.provider)}, and the account it reads through stays connected.`}
        footer={
          <button type="button" className={`${dk.btn} ${dk.btnDanger}`} disabled={removing} onClick={() => void remove()}>
            {removing ? <Loader2 size={13} className={dk.spin} /> : <Trash2 size={13} />} Remove team
          </button>
        }
      />
    </div>
  );
}

function formatWeight(w: number): string {
  const rounded = Math.round(w * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toString();
  return rounded > 0 ? `+${text}` : text;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function scheduleFacts(periods: Record<string, unknown>): Array<[string, React.ReactNode]> {
  const out: Array<[string, React.ReactNode]> = [];
  const count = asNumber(periods.period_count);
  const length = asNumber(periods.period_length);
  const startWeek = asNumber(periods.start_week);
  const endWeek = asNumber(periods.end_week);
  const playoffStart = asNumber(periods.playoff_start_week);
  const playoffTeams = asNumber(periods.playoff_team_count);
  const playoffLength = asNumber(periods.playoff_period_length);
  if (startWeek !== null && endWeek !== null) out.push(["Weeks", `${startWeek}–${endWeek}`]);
  if (count !== null) out.push(["Matchups", String(count)]);
  if (length !== null && length !== 1) out.push(["Weeks each", String(length)]);
  if (playoffTeams !== null) out.push(["Playoff teams", String(playoffTeams)]);
  if (playoffStart !== null) out.push(["Playoffs from", `week ${playoffStart}`]);
  if (playoffLength !== null && playoffLength !== 1) out.push(["Playoff round", `${playoffLength} wk`]);
  return out;
}

function LeagueFacts({ league }: { league: LeagueDetail }) {
  const winMode = winModeLabel(league.category_win_mode);
  const weights = Object.entries(league.point_weights ?? {})
    .filter(([, w]) => typeof w === "number" && w !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const slots = Object.entries(league.roster_slots ?? {}).filter(([, n]) => n > 0);
  const schedule = scheduleFacts(league.matchup_periods ?? {});
  const limits = Object.entries(league.position_limits ?? {}).filter(([, n]) => n > 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Facts
        items={[
          ["Format", `${formatLabel(league)}${winMode ? ` · ${winMode.toLowerCase()}` : ""}`],
          ["Season", seasonLabel(league.provider, league.season) ?? String(league.season)],
          ["League", `${league.name ?? "—"} · ${league.provider.toUpperCase()} ${league.provider_league_id}`],
        ]}
      />
      {league.scoring_type === "categories" && league.categories.length ? (
        <div>
          <span className={dk.label} style={{ display: "block", marginBottom: 8 }}>
            Categories · {league.categories.length}
          </span>
          <div className={s.chips}>
            {league.categories.map((c) => (
              <span key={c.key} className={s.statChip} title={c.higher_is_better ? "Higher is better" : "Lower is better"}>
                {c.label}
                {polarityGlyph(c) ? <em>{polarityGlyph(c)}</em> : null}
                {c.is_rate ? <em>rate</em> : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {league.scoring_type === "points" && weights.length ? (
        <div>
          <span className={dk.label} style={{ display: "block", marginBottom: 8 }}>
            Point weights
          </span>
          <div className={s.weights}>
            {weights.map(([key, w]) => (
              <div key={key} className={s.weight}>
                <span>{statLabel(key)}</span>
                <span className={w < 0 ? s.neg : undefined}>{formatWeight(w)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className={s.two}>
        {slots.length ? (
          <div>
            <span className={dk.label} style={{ display: "block", marginBottom: 8 }}>
              Roster
            </span>
            <div className={s.chips}>
              {slots.map(([slot, n]) => (
                <span key={slot} className={s.statChip}>
                  {slot} <em>×{n}</em>
                </span>
              ))}
              {limits.map(([pos, n]) => (
                <span key={`limit-${pos}`} className={s.statChip} title="At most this many on the roster">
                  {pos} <em>≤{n}</em>
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {schedule.length ? (
          <div>
            <span className={dk.label} style={{ display: "block", marginBottom: 8 }}>
              Schedule
            </span>
            <Facts items={schedule} />
          </div>
        ) : null}
      </div>
      {league.warnings.length ? (
        <div className={s.formNote} data-tone="warn">
          <span className={s.inline} style={{ color: "var(--warn)", fontWeight: 500 }}>
            <AlertTriangle size={13} /> Worth knowing
          </span>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {league.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {league.unsupported.length ? <span className={s.fieldHint}>Not used by Court Vision: {league.unsupported.map(statLabel).join(", ")}.</span> : null}
    </div>
  );
}
