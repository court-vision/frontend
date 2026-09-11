/**
 * Provider connections, presented: which are ESPN's, which one a team uses,
 * and how to describe a connection's state in a line.
 *
 * Pure so it can be unit-tested without React.
 */
import { normalizeProviderScoringType } from "./category-format";
import { formatRelativeTime } from "./relative-time";
import type { ConnectionStatus, ProviderConnection } from "@/types/connections";

export type ConnectionTone = "ok" | "error" | "muted";

/** The user's ESPN connections, in the order the API lists them. */
export function espnConnections(list: readonly ProviderConnection[] | undefined): ProviderConnection[] {
  return (list ?? []).filter((c) => c.provider === "espn");
}

/** The connection a team's provider calls take their credentials from, if any. */
export function connectionForTeam(
  list: readonly ProviderConnection[] | undefined,
  teamId: number
): ProviderConnection | null {
  return (list ?? []).find((c) => c.teams.some((t) => t.team_id === teamId)) ?? null;
}

/** "ESPN account …E5F6", or just "ESPN account" without a hint. */
export function accountLabel(connection: Pick<ProviderConnection, "account_hint">): string {
  return connection.account_hint ? `ESPN account ${connection.account_hint}` : "ESPN account";
}

/** The last four characters of a SWID's GUID, as `account_hint` shows them. */
export function swidHint(swid: string): string | null {
  const guid = swid.replace(/[\s{}]/g, "").toUpperCase();
  return guid.length >= 4 ? `…${guid.slice(-4)}` : null;
}

export function connectionStatusLabel(status: ConnectionStatus): { label: string; tone: ConnectionTone } {
  switch (status) {
    case "ok":
      return { label: "Connected", tone: "ok" };
    case "expired":
      return { label: "Expired", tone: "error" };
    default:
      return { label: "Not verified", tone: "muted" };
  }
}

/** The line under a connection: ESPN's last verdict on its cookies, or when they were saved. */
export function connectionFreshness(
  connection: Pick<ProviderConnection, "status" | "verified_at" | "auth_failed_at" | "updated_at">,
  nowMs: number = Date.now()
): string {
  const ago = (iso: string) => formatRelativeTime(Date.parse(iso), nowMs);
  if (connection.status === "expired" && connection.auth_failed_at) {
    return `rejected by ESPN ${ago(connection.auth_failed_at)}`;
  }
  if (connection.verified_at) return `checked ${ago(connection.verified_at)}`;
  return `saved ${ago(connection.updated_at)}`;
}

/** "1 team", "3 teams". */
export function teamCount(n: number): string {
  return `${n} ${n === 1 ? "team" : "teams"}`;
}

/** ESPN's format name from its fan API (H2H_POINTS, H2H_CATEGORY, ROTO, ...) as the app labels it. */
export function espnScoringFormat(
  raw: string | null | undefined
): ReturnType<typeof normalizeProviderScoringType> {
  const name = (raw ?? "").toUpperCase();
  if (name.includes("CATEGOR")) return normalizeProviderScoringType("categories");
  if (name.includes("ROTO")) return normalizeProviderScoringType("roto");
  if (name.includes("POINTS")) return normalizeProviderScoringType("points");
  return normalizeProviderScoringType(raw);
}
