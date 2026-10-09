/**
 * The Account desk's pure model: what the URL points at, how a team and a
 * connection are described in a line, what is wrong and where to go to fix
 * it, and the steps of adding a team. No React, no fetching, so every rule
 * here is unit-tested on its own.
 */
import type { EspnAccountTeam, ProviderConnection } from "@/types/connections";
import type { components } from "@/types/generated/api";
import type { FantasyProvider, LeagueSummary, TeamResponseData } from "@/types/team";
import { formatRelativeTime } from "./relative-time";

export type Capabilities = components["schemas"]["ProviderCapabilitiesResp"];

// ---------------------------------------------------------------------------
// Focus: what the desk shows, and the URL that says so
// ---------------------------------------------------------------------------

export type AccountFocus =
  | { kind: "overview" }
  | { kind: "team"; id: number }
  | { kind: "connection"; id: number }
  | { kind: "alerts" }
  | { kind: "account" };

export const OVERVIEW: AccountFocus = { kind: "overview" };

const ID = /^\d{1,9}$/;

/** `?t=<team>`, `?c=<connection>`, `?v=alerts|account`; anything else is the overview. */
export function focusFromSearch(p: URLSearchParams): AccountFocus {
  const t = p.get("t");
  if (t && ID.test(t)) return { kind: "team", id: Number(t) };
  const c = p.get("c");
  if (c && ID.test(c)) return { kind: "connection", id: Number(c) };
  const v = p.get("v");
  if (v === "alerts" || v === "account") return { kind: v };
  return OVERVIEW;
}

/** The query that reopens `focus` (without the leading `?`); empty for the overview. */
export function focusToSearch(focus: AccountFocus): string {
  switch (focus.kind) {
    case "team":
      return `t=${focus.id}`;
    case "connection":
      return `c=${focus.id}`;
    case "alerts":
    case "account":
      return `v=${focus.kind}`;
    default:
      return "";
  }
}

export function focusKey(focus: AccountFocus): string {
  return focus.kind === "team" || focus.kind === "connection" ? `${focus.kind}:${focus.id}` : focus.kind;
}

export function sameFocus(a: AccountFocus, b: AccountFocus): boolean {
  return focusKey(a) === focusKey(b);
}

// ---------------------------------------------------------------------------
// Describing a team
// ---------------------------------------------------------------------------

export function providerLabel(provider: FantasyProvider | null | undefined): string {
  return provider === "yahoo" ? "Yahoo" : "ESPN";
}

/**
 * The season a provider's year means, as "2026–27". ESPN names a season by the
 * year it ends in (its `seasonId` 2027 is 2026–27); Yahoo by the year it
 * starts in (its `season` 2026 is the same one).
 */
export function seasonLabel(provider: FantasyProvider | null | undefined, year: number | null | undefined): string | null {
  if (year == null || !Number.isFinite(year)) return null;
  const start = provider === "yahoo" ? year : year - 1;
  return `${start}–${String(start + 1).slice(-2)}`;
}

/** The compact format tag the team switcher shows: PTS, CATS, ROTO, or PTS with a question mark until the league is synced. */
export function formatTag(league: LeagueSummary | null | undefined): string {
  if (!league?.settings_synced) return "PTS?";
  switch (league.scoring_type) {
    case "categories":
      return "CATS";
    case "roto":
      return "ROTO";
    default:
      return "PTS";
  }
}

/** "H2H 9-cat", "H2H points", "Roto", or "Not synced"; with " · preview" when the view is overridden. */
export function formatLabel(league: LeagueSummary | null | undefined): string {
  if (!league) return "Not synced";
  if (!league.settings_synced) return "Points (not synced)";
  const suffix = league.scoring_preview ? " · preview" : "";
  switch (league.scoring_type) {
    case "categories": {
      const n = league.categories?.length ?? 0;
      return (n > 0 ? `H2H ${n}-cat` : "H2H categories") + suffix;
    }
    case "roto":
      return "Roto" + suffix;
    default:
      return "H2H points" + suffix;
  }
}

/** "ESPN · PTS": the tag beside a team's name in the switcher. */
export function teamTag(team: TeamResponseData): string {
  return `${providerLabel(team.league_info?.provider).toUpperCase()} · ${formatTag(team.league)}`;
}

export function teamName(team: TeamResponseData): string {
  return team.league_info?.team_name?.trim() || `Team ${team.team_id}`;
}

/** A league's name, or "League <id>" when none was given (the backend stores "N/A" for none). */
export function leagueName(name: string | null | undefined, leagueId: number | null | undefined): string {
  const n = (name ?? "").trim();
  if (n && n.toUpperCase() !== "N/A") return n;
  return leagueId != null ? `League ${leagueId}` : "League";
}

/** "Lvl. 3 Goblins · 2026–27 · ESPN": the line under a team's name. */
export function teamLine(team: TeamResponseData): string {
  const info = team.league_info;
  const season = seasonLabel(info?.provider, team.league?.season ?? info?.year);
  return [leagueName(team.league?.name ?? info?.league_name, info?.league_id), season, providerLabel(info?.provider)].filter(Boolean).join(" · ");
}

export interface CapabilityRow {
  key: keyof Capabilities;
  label: string;
  on: boolean;
  /** Why it matters, in a few words. */
  note: string;
}

/** What this team's provider can do for it, in the order a manager cares. */
export function capabilityRows(caps: Capabilities | null | undefined): CapabilityRow[] {
  const c = caps ?? ({} as Partial<Capabilities>);
  const row = (key: keyof Capabilities, label: string, note: string): CapabilityRow => ({ key, label, on: !!c[key], note });
  return [
    row("lineup_read", "Read lineups", "Each day's lineup as the provider has it"),
    row("lineup_write", "Set lineups", "Moves sent from the Week desk"),
    row("transactions", "Adds and drops", "Pickups now, or scheduled for a later day"),
    row("daily_lineups", "Daily lineups", "A lineup per day, not per week"),
    row("live_totals", "Live totals", "The provider's own matchup score moves during games"),
    row("position_limits", "Position limits", "Per-position roster caps the provider enforces"),
    row("account_teams", "Account teams", "Every team on the account can be listed"),
    row("draft_import", "Draft import", "A finished draft can be pulled into the Draft desk"),
    row("draft_sync", "Draft sync", "A live draft follows along through the tap"),
    row("waiver_claims", "Waiver claims", "Claims on players still on waivers"),
    row("write_scope", "Write access granted", "The connection's grant allows writes"),
  ];
}

/** One line on what Court Vision can send: "Lineups, adds and drops", "Lineups only", or "Read only". */
export function writeSummary(caps: Capabilities | null | undefined): string {
  const lineups = !!caps?.lineup_write;
  const moves = !!caps?.transactions;
  if (lineups && moves) return "Lineups, adds and drops";
  if (lineups) return "Lineups only";
  if (moves) return "Adds and drops only";
  return "Read only";
}

// ---------------------------------------------------------------------------
// Describing a connection
// ---------------------------------------------------------------------------

export function connectionTitle(c: Pick<ProviderConnection, "provider" | "account_hint">): string {
  if (c.provider === "yahoo") return "Yahoo account";
  return c.account_hint ? `ESPN account ${c.account_hint}` : "ESPN account";
}

export type ConnectionTone = "ok" | "warn" | "muted";

export function connectionState(c: Pick<ProviderConnection, "status">): { label: string; tone: ConnectionTone } {
  switch (c.status) {
    case "ok":
      return { label: "Connected", tone: "ok" };
    case "expired":
      return { label: "Expired", tone: "warn" };
    default:
      return { label: "Not verified", tone: "muted" };
  }
}

/** The line under a connection: the provider's last verdict, or when it was saved. */
export function connectionLine(
  c: Pick<ProviderConnection, "provider" | "status" | "verified_at" | "auth_failed_at" | "updated_at">,
  nowMs: number
): string {
  const ago = (iso: string) => formatRelativeTime(Date.parse(iso), nowMs);
  if (c.status === "expired" && c.auth_failed_at) return `rejected by ${providerLabel(c.provider)} ${ago(c.auth_failed_at)}`;
  if (c.verified_at) return `checked ${ago(c.verified_at)}`;
  return `saved ${ago(c.updated_at)}`;
}

/** The connection a team's provider calls draw on, if one lists it. */
export function connectionForTeam(connections: readonly ProviderConnection[], teamId: number): ProviderConnection | null {
  return connections.find((c) => c.teams.some((t) => t.team_id === teamId)) ?? null;
}

export type Credentials =
  | { kind: "connection"; connection: ProviderConnection }
  /** Credentials saved on the team itself, before accounts existed. */
  | { kind: "inline" }
  | { kind: "none" };

export function teamCredentials(team: TeamResponseData, connections: readonly ProviderConnection[]): Credentials {
  const connection = connectionForTeam(connections, team.team_id);
  if (connection) return { kind: "connection", connection };
  const info = team.league_info;
  if (info?.has_espn_credentials || info?.has_yahoo_credentials) return { kind: "inline" };
  return { kind: "none" };
}

/** A usable connection for a provider: any that is not known to be expired, the verified ones first. */
export function usableConnections(connections: readonly ProviderConnection[], provider: FantasyProvider): ProviderConnection[] {
  return connections
    .filter((c) => c.provider === provider && c.status !== "expired")
    .sort((a, b) => (a.status === "ok" ? 0 : 1) - (b.status === "ok" ? 0 : 1));
}

// ---------------------------------------------------------------------------
// What is wrong, and where to fix it
// ---------------------------------------------------------------------------

export type IssueTarget = AccountFocus | { kind: "add" };

export interface Issue {
  id: string;
  text: string;
  /** The button's label. */
  action: string;
  target: IssueTarget;
  /** `warn` needs doing; `note` is worth knowing. */
  level: "warn" | "note";
}

export function issues(teams: readonly TeamResponseData[], connections: readonly ProviderConnection[]): Issue[] {
  const out: Issue[] = [];
  for (const c of connections) {
    if (c.status === "expired") {
      const n = c.teams.length;
      out.push({
        id: `connection-expired-${c.id}`,
        text: `${providerLabel(c.provider)} rejected the ${connectionTitle(c)}'s ${c.provider === "yahoo" ? "login" : "cookies"}${n ? `; ${n} ${n === 1 ? "team reads" : "teams read"} through it` : ""}.`,
        action: c.provider === "yahoo" ? "Reconnect" : "Update cookies",
        target: { kind: "connection", id: c.id },
        level: "warn",
      });
    }
  }
  for (const team of teams) {
    const name = teamName(team);
    const creds = teamCredentials(team, connections);
    if (creds.kind === "none" && team.league_info?.provider !== "yahoo") {
      out.push({
        id: `team-no-credentials-${team.team_id}`,
        text: `${name} reads ESPN without cookies: fine for a public league, refused by a private one.`,
        action: "Link an account",
        target: { kind: "team", id: team.team_id },
        level: "note",
      });
    }
    if (!team.league?.settings_synced) {
      out.push({
        id: `team-unsynced-${team.team_id}`,
        text: `${name}'s league settings have not been read yet, so it is scored as a points league.`,
        action: "Sync",
        target: { kind: "team", id: team.team_id },
        level: "note",
      });
    }
  }
  for (const c of connections) {
    if (c.status === "unknown" && c.provider === "espn") {
      out.push({
        id: `connection-unverified-${c.id}`,
        text: `The ${connectionTitle(c)} has not been checked against a private league yet.`,
        action: "Check",
        target: { kind: "connection", id: c.id },
        level: "note",
      });
    }
  }
  if (teams.length === 0) {
    out.push({ id: "no-teams", text: "No teams yet. Add one and the Week desk fills in.", action: "Add a team", target: { kind: "add" }, level: "warn" });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Adding a team
// ---------------------------------------------------------------------------

export type AddStep =
  | "provider"
  | "espn-connect"
  | "espn-list"
  | "espn-manual"
  | "yahoo-connect"
  | "yahoo-league"
  | "yahoo-team";

/** Where the add flow starts for a provider: straight to the account's teams when an account is usable. */
export function firstStep(provider: FantasyProvider, connections: readonly ProviderConnection[]): AddStep {
  if (provider === "yahoo") return usableConnections(connections, "yahoo").length ? "yahoo-league" : "yahoo-connect";
  return usableConnections(connections, "espn").length ? "espn-list" : "espn-connect";
}

/**
 * The team names ESPN's validation lists when the typed one is not in the
 * league ("Team 'X' not found in league 123; teams: A, B, C"), so they can
 * be offered as choices instead of an error.
 */
export function teamNamesFromMessage(message: string | null | undefined): string[] {
  const m = (message ?? "").match(/;\s*teams:\s*(.+)$/);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** ESPN's season id for a season key: "2026-27" → 2027 (ESPN names a season by the year it ends in). */
export function espnSeasonId(seasonKey: string): number {
  const start = parseInt(seasonKey.slice(0, 4), 10);
  return Number.isNaN(start) ? new Date().getFullYear() : start + 1;
}

/** ESPN's format name ("H2H_POINTS", "H2H_CATEGORY", "ROTO") as the desk labels it. */
export function espnFormatLabel(raw: string | null | undefined): string | null {
  const name = (raw ?? "").toUpperCase();
  if (!name) return null;
  if (name.includes("CATEGOR")) return "H2H categories";
  if (name.includes("ROTO")) return "Roto";
  if (name.includes("POINTS")) return "H2H points";
  return raw ?? null;
}

/** "Lvl. 3 Goblins · 12 teams · H2H points · 2026–27" for a team ESPN lists on the account. */
export function accountTeamLine(t: EspnAccountTeam): string {
  return [
    t.league_name ?? `League ${t.league_id}`,
    t.league_size ? `${t.league_size} teams` : null,
    espnFormatLabel(t.scoring_type),
    seasonLabel("espn", t.season),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The teams ESPN lists, newest season first, the ones already tracked last within a season. */
export function sortAccountTeams(teams: readonly EspnAccountTeam[]): EspnAccountTeam[] {
  return [...teams].sort(
    (a, b) => b.season - a.season || Number(a.tracked_team_id != null) - Number(b.tracked_team_id != null) || a.team_name.localeCompare(b.team_name)
  );
}

// ---------------------------------------------------------------------------
// The Yahoo round trip
// ---------------------------------------------------------------------------

export type YahooReturn = { kind: "connected"; connectionId: number } | { kind: "error"; code: string };

/** What the Yahoo callback appended to the URL it sent the browser back to, if anything. */
export function yahooReturn(p: URLSearchParams): YahooReturn | null {
  const error = p.get("yahoo_error");
  if (error) return { kind: "error", code: error };
  const id = p.get("yahoo_connection");
  if (p.get("yahoo_connected") === "true" && id && ID.test(id)) return { kind: "connected", connectionId: Number(id) };
  return null;
}

/** The same query without the callback's parameters, for cleaning the URL once they are consumed. */
export function withoutYahooReturn(p: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams(p);
  for (const key of ["yahoo_connected", "yahoo_connection", "yahoo_error"]) out.delete(key);
  return out;
}

const SAFE_VALUE = /^[A-Za-z0-9_\-.~]*$/;
const RETURN_PATH_MAX = 200;

/**
 * Where the Yahoo callback should send the browser back: this page, keeping
 * only the query keys named (and only plain values), so the path passes the
 * backend's own check and never carries the callback's leftovers.
 */
export function returnPath(pathname: string, search: URLSearchParams, keep: readonly string[] = []): string {
  const q = new URLSearchParams();
  for (const key of keep) {
    const v = search.get(key);
    if (v != null && SAFE_VALUE.test(v) && SAFE_VALUE.test(key)) q.set(key, v);
  }
  const qs = q.toString();
  const path = qs ? `${pathname}?${qs}` : pathname;
  return path.length <= RETURN_PATH_MAX ? path : pathname;
}
