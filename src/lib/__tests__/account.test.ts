import { describe, expect, test } from "bun:test";
import {
  accountTeamLine,
  capabilityRows,
  connectionLine,
  connectionState,
  connectionTitle,
  espnSeasonId,
  firstStep,
  focusFromSearch,
  focusToSearch,
  formatLabel,
  formatTag,
  issues,
  leagueName,
  returnPath,
  sameFocus,
  seasonLabel,
  sortAccountTeams,
  teamCredentials,
  teamLine,
  teamNamesFromMessage,
  teamTag,
  usableConnections,
  withoutYahooReturn,
  writeSummary,
  yahooReturn,
  type Capabilities,
} from "../account";
import type { EspnAccountTeam, ProviderConnection } from "@/types/connections";
import type { LeagueSummary, TeamResponseData } from "@/types/team";

const NOW = Date.parse("2026-10-09T12:00:00Z");

const CAPS: Capabilities = {
  account_teams: true,
  daily_lineups: true,
  draft_import: true,
  draft_sync: true,
  lineup_read: true,
  lineup_write: true,
  live_totals: false,
  position_limits: true,
  transactions: true,
  waiver_claims: false,
  write_scope: true,
};

function league(over: Partial<LeagueSummary> = {}): LeagueSummary {
  return {
    id: 1,
    provider: "espn",
    provider_league_id: "993431466",
    season: 2027,
    name: "Lvl. 3 Goblins",
    scoring_type: "points",
    category_win_mode: null,
    categories: [],
    point_weights: { pts: 1 },
    settings_synced: true,
    settings_synced_at: "2026-10-01T00:00:00Z",
    scoring_preview: null,
    ...over,
  };
}

function team(over: Partial<TeamResponseData> & { info?: Partial<TeamResponseData["league_info"]> } = {}): TeamResponseData {
  const { info, ...rest } = over;
  return {
    team_id: 22,
    league_info: {
      provider: "espn",
      league_id: 993431466,
      team_name: "GloatingSoap369",
      league_name: "Lvl. 3 Goblins",
      year: 2027,
      yahoo_team_key: null,
      espn_team_id: 4,
      scoring_preview: null,
      has_espn_credentials: true,
      has_yahoo_credentials: false,
      ...info,
    },
    league: league(),
    capabilities: CAPS,
    ...rest,
  };
}

function connection(over: Partial<ProviderConnection> = {}): ProviderConnection {
  return {
    id: 1,
    provider: "espn",
    account_hint: "…E5F6",
    status: "ok",
    verified_at: "2026-10-08T12:00:00Z",
    auth_failed_at: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-10-08T12:00:00Z",
    teams: [{ team_id: 22, team_name: "GloatingSoap369", league_name: "Lvl. 3 Goblins", league_id: 993431466, year: 2027 }],
    ...over,
  };
}

describe("focus", () => {
  test("round-trips through the URL", () => {
    for (const q of ["", "t=22", "c=1", "v=alerts", "v=account"]) {
      expect(focusToSearch(focusFromSearch(new URLSearchParams(q)))).toBe(q);
    }
  });

  test("anything malformed is the overview", () => {
    for (const q of ["t=abc", "t=-1", "c=", "v=keys", "t=1234567890"]) {
      expect(focusFromSearch(new URLSearchParams(q)).kind).toBe("overview");
    }
  });

  test("a team beats a connection when both are present", () => {
    expect(focusFromSearch(new URLSearchParams("c=1&t=2"))).toEqual({ kind: "team", id: 2 });
    expect(sameFocus({ kind: "team", id: 2 }, { kind: "team", id: 2 })).toBe(true);
    expect(sameFocus({ kind: "team", id: 2 }, { kind: "connection", id: 2 })).toBe(false);
  });
});

describe("describing a team", () => {
  test("seasons: ESPN names the end year, Yahoo the start year", () => {
    expect(seasonLabel("espn", 2027)).toBe("2026–27");
    expect(seasonLabel("yahoo", 2026)).toBe("2026–27");
    expect(seasonLabel("espn", null)).toBeNull();
  });

  test("tags and labels follow the synced league", () => {
    expect(teamTag(team())).toBe("ESPN · PTS");
    expect(formatTag(league({ scoring_type: "categories" }))).toBe("CATS");
    expect(formatTag(league({ scoring_type: "roto" }))).toBe("ROTO");
    expect(formatTag(league({ settings_synced: false }))).toBe("PTS?");
    expect(formatTag(null)).toBe("PTS?");
    expect(formatLabel(league({ scoring_type: "categories", categories: Array.from({ length: 9 }, (_, i) => ({ key: `c${i}`, label: `C${i}`, higher_is_better: true, is_rate: false })) }))).toBe("H2H 9-cat");
    expect(formatLabel(league({ scoring_preview: "categories" }))).toBe("H2H points · preview");
    expect(formatLabel(null)).toBe("Not synced");
  });

  test("a league's name hides the backend's placeholder", () => {
    expect(leagueName("Lvl. 3 Goblins", 1)).toBe("Lvl. 3 Goblins");
    expect(leagueName("N/A", 993431466)).toBe("League 993431466");
    expect(leagueName("  ", 5)).toBe("League 5");
    expect(leagueName(null, null)).toBe("League");
  });

  test("the line under the name: league, season, provider", () => {
    expect(teamLine(team())).toBe("Lvl. 3 Goblins · 2026–27 · ESPN");
    expect(teamLine(team({ league: null, info: { league_name: "N/A" } }))).toBe("League 993431466 · 2026–27 · ESPN");
    expect(teamLine(team({ league: null, info: { provider: "yahoo", league_name: "Yahoo Pub", year: 2026 } }))).toBe("Yahoo Pub · 2026–27 · Yahoo");
  });

  test("capabilities read as a list and as one line", () => {
    const rows = capabilityRows(CAPS);
    expect(rows.map((r) => r.key)).toContain("lineup_write");
    expect(rows.find((r) => r.key === "live_totals")?.on).toBe(false);
    expect(writeSummary(CAPS)).toBe("Lineups, adds and drops");
    expect(writeSummary({ ...CAPS, transactions: false })).toBe("Lineups only");
    expect(writeSummary({ ...CAPS, lineup_write: false })).toBe("Adds and drops only");
    expect(writeSummary({ ...CAPS, lineup_write: false, transactions: false })).toBe("Read only");
    expect(writeSummary(null)).toBe("Read only");
  });
});

describe("describing a connection", () => {
  test("title and state", () => {
    expect(connectionTitle(connection())).toBe("ESPN account …E5F6");
    expect(connectionTitle(connection({ account_hint: null }))).toBe("ESPN account");
    expect(connectionTitle(connection({ provider: "yahoo", account_hint: null }))).toBe("Yahoo account");
    expect(connectionState(connection()).label).toBe("Connected");
    expect(connectionState(connection({ status: "expired" })).tone).toBe("warn");
    expect(connectionState(connection({ status: "unknown" })).label).toBe("Not verified");
  });

  test("the line names the provider's verdict", () => {
    expect(connectionLine(connection(), NOW)).toBe("checked 1 d ago");
    expect(connectionLine(connection({ status: "expired", auth_failed_at: "2026-10-09T11:00:00Z" }), NOW)).toBe("rejected by ESPN 1 h ago");
    expect(connectionLine(connection({ provider: "yahoo", status: "expired", auth_failed_at: "2026-10-09T11:00:00Z" }), NOW)).toBe("rejected by Yahoo 1 h ago");
    expect(connectionLine(connection({ verified_at: null, updated_at: "2026-10-09T11:30:00Z" }), NOW)).toBe("saved 30 min ago");
  });

  test("a team's credentials: its connection, its own, or none", () => {
    expect(teamCredentials(team(), [connection()])).toMatchObject({ kind: "connection" });
    expect(teamCredentials(team(), [connection({ teams: [] })])).toEqual({ kind: "inline" });
    expect(teamCredentials(team({ info: { has_espn_credentials: false } }), [])).toEqual({ kind: "none" });
  });

  test("usable connections leave the expired ones out and put the verified first", () => {
    const list = [
      connection({ id: 1, status: "unknown" }),
      connection({ id: 2, status: "expired" }),
      connection({ id: 3, status: "ok" }),
      connection({ id: 4, provider: "yahoo", status: "ok" }),
    ];
    expect(usableConnections(list, "espn").map((c) => c.id)).toEqual([3, 1]);
    expect(usableConnections(list, "yahoo").map((c) => c.id)).toEqual([4]);
  });
});

describe("issues", () => {
  test("an expired connection comes first, with the fix", () => {
    const out = issues([team()], [connection({ status: "expired" })]);
    expect(out[0]).toMatchObject({ level: "warn", action: "Update cookies", target: { kind: "connection", id: 1 } });
    expect(out[0].text).toContain("1 team reads through it");
  });

  test("a team without cookies, an unsynced league, an unchecked account, and no teams at all", () => {
    const t = team({ info: { has_espn_credentials: false }, league: league({ settings_synced: false }) });
    const out = issues([t], [connection({ teams: [], status: "unknown" })]);
    expect(out.map((i) => i.action)).toEqual(["Link an account", "Sync", "Check"]);
    expect(issues([], []).map((i) => i.id)).toEqual(["no-teams"]);
  });

  test("a Yahoo team without inline tokens is not a cookie problem", () => {
    const t = team({ info: { provider: "yahoo", has_espn_credentials: false } });
    expect(issues([t], []).map((i) => i.action)).toEqual([]);
  });
});

describe("adding a team", () => {
  test("starts at the account's teams when an account is usable, else at connecting", () => {
    expect(firstStep("espn", [])).toBe("espn-connect");
    expect(firstStep("espn", [connection({ status: "expired" })])).toBe("espn-connect");
    expect(firstStep("espn", [connection({ status: "unknown" })])).toBe("espn-list");
    expect(firstStep("yahoo", [])).toBe("yahoo-connect");
    expect(firstStep("yahoo", [connection({ provider: "yahoo" })])).toBe("yahoo-league");
  });

  test("ESPN's team list is read out of its validation message", () => {
    expect(teamNamesFromMessage("Team 'X' not found in league 1; teams: Goblins, Paint Beasts , Team C")).toEqual(["Goblins", "Paint Beasts", "Team C"]);
    expect(teamNamesFromMessage("ESPN league not found")).toEqual([]);
    expect(teamNamesFromMessage(null)).toEqual([]);
  });

  test("ESPN's season id is the year the season ends in", () => {
    expect(espnSeasonId("2026-27")).toBe(2027);
  });

  test("an account team's line and the list's order", () => {
    const row = (over: Partial<EspnAccountTeam>): EspnAccountTeam => ({
      espn_team_id: 1,
      league_id: 10,
      league_name: "Goblins",
      league_size: 12,
      scoring_type: "H2H_POINTS",
      season: 2027,
      team_abbrev: "GS",
      team_name: "Soap",
      tracked_team_id: null,
      ...over,
    });
    expect(accountTeamLine(row({}))).toBe("Goblins · 12 teams · H2H points · 2026–27");
    expect(accountTeamLine(row({ league_name: null, league_size: null, scoring_type: "H2H_CATEGORY" }))).toBe("League 10 · H2H categories · 2026–27");
    const sorted = sortAccountTeams([
      row({ team_name: "B", season: 2026 }),
      row({ team_name: "A", season: 2027, tracked_team_id: 22 }),
      row({ team_name: "C", season: 2027 }),
    ]);
    expect(sorted.map((t) => t.team_name)).toEqual(["C", "A", "B"]);
  });
});

describe("the Yahoo round trip", () => {
  test("reads what the callback appended", () => {
    expect(yahooReturn(new URLSearchParams("yahoo_connected=true&yahoo_connection=99"))).toEqual({ kind: "connected", connectionId: 99 });
    expect(yahooReturn(new URLSearchParams("yahoo_error=access_denied"))).toEqual({ kind: "error", code: "access_denied" });
    expect(yahooReturn(new URLSearchParams("yahoo_connected=true"))).toBeNull();
    expect(yahooReturn(new URLSearchParams("view=matchup"))).toBeNull();
  });

  test("cleans the URL and keeps the rest", () => {
    expect(withoutYahooReturn(new URLSearchParams("view=matchup&yahoo_connected=true&yahoo_connection=99")).toString()).toBe("view=matchup");
  });

  test("the return path keeps only the keys named, with plain values", () => {
    expect(returnPath("/week", new URLSearchParams("view=matchup&market=day&yahoo_error=x"), ["view", "market"])).toBe("/week?view=matchup&market=day");
    expect(returnPath("/week", new URLSearchParams("view=a b"), ["view"])).toBe("/week");
    expect(returnPath("/me", new URLSearchParams("t=22"), [])).toBe("/me");
    expect(returnPath("/me", new URLSearchParams(`t=${"9".repeat(250)}`), ["t"])).toBe("/me");
  });
});
