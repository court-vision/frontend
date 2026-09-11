import { describe, expect, test } from "bun:test";
import {
  accountLabel,
  connectionForTeam,
  connectionFreshness,
  connectionStatusLabel,
  espnConnections,
  espnScoringFormat,
  swidHint,
  teamCount,
} from "../connections";
import type { ProviderConnection } from "@/types/connections";

const NOW = Date.parse("2026-09-11T12:00:00Z");

function connection(overrides: Partial<ProviderConnection> = {}): ProviderConnection {
  return {
    id: 1,
    provider: "espn",
    account_hint: "…E5F6",
    status: "unknown",
    verified_at: null,
    auth_failed_at: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-10T12:00:00Z",
    teams: [],
    ...overrides,
  };
}

describe("finding connections", () => {
  test("ESPN connections leave Yahoo out", () => {
    const list = [connection({ id: 1 }), connection({ id: 2, provider: "yahoo", account_hint: null })];
    expect(espnConnections(list).map((c) => c.id)).toEqual([1]);
    expect(espnConnections(undefined)).toEqual([]);
  });

  test("a team's connection is the one listing it", () => {
    const team = { team_id: 7, team_name: "Goblins", league_name: "League", league_id: 1, year: 2027 };
    const list = [connection({ id: 1 }), connection({ id: 2, teams: [team] })];
    expect(connectionForTeam(list, 7)?.id).toBe(2);
    expect(connectionForTeam(list, 8)).toBeNull();
    expect(connectionForTeam(undefined, 7)).toBeNull();
  });
});

describe("describing a connection", () => {
  test("labels the account by its hint", () => {
    expect(accountLabel(connection())).toBe("ESPN account …E5F6");
    expect(accountLabel({ account_hint: null })).toBe("ESPN account");
  });

  test("maps each status to a label and tone", () => {
    expect(connectionStatusLabel("ok")).toEqual({ label: "Connected", tone: "ok" });
    expect(connectionStatusLabel("expired")).toEqual({ label: "Expired", tone: "error" });
    expect(connectionStatusLabel("unknown")).toEqual({ label: "Not verified", tone: "muted" });
  });

  test("an expired connection says when ESPN rejected it", () => {
    const c = connection({
      status: "expired",
      verified_at: "2026-09-01T00:00:00Z",
      auth_failed_at: "2026-09-11T10:00:00Z",
    });
    expect(connectionFreshness(c, NOW)).toBe("rejected by ESPN 2 h ago");
  });

  test("a checked connection says when it was checked", () => {
    expect(connectionFreshness(connection({ status: "ok", verified_at: "2026-09-11T11:57:00Z" }), NOW)).toBe(
      "checked 3 min ago"
    );
  });

  test("an unchecked connection says when it was saved", () => {
    expect(connectionFreshness(connection(), NOW)).toBe("saved 1 d ago");
  });

  test("counts teams", () => {
    expect(teamCount(0)).toBe("0 teams");
    expect(teamCount(1)).toBe("1 team");
    expect(teamCount(3)).toBe("3 teams");
  });
});

describe("swidHint", () => {
  test("matches the account hint however the SWID is spelled", () => {
    expect(swidHint("{3f2a9c1e-1b2c-4d5e-8f90-a1b2c3d4e5f6}")).toBe("…E5F6");
    expect(swidHint(" 3F2A9C1E-1B2C-4D5E-8F90-A1B2C3D4E5F6 ")).toBe("…E5F6");
    expect(swidHint("{}")).toBeNull();
  });
});

describe("espnScoringFormat", () => {
  test("maps ESPN's fan-API format names", () => {
    expect(espnScoringFormat("H2H_POINTS").type).toBe("points");
    expect(espnScoringFormat("H2H_CATEGORY").type).toBe("categories");
    expect(espnScoringFormat("H2H_MOST_CATEGORIES").type).toBe("categories");
    expect(espnScoringFormat("ROTO").type).toBe("roto");
    expect(espnScoringFormat(null).type).toBe("unknown");
  });
});
