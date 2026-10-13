import { afterEach, describe, expect, test } from "bun:test";
import { QueriesObserver, QueryClient, type QueryObserverResult } from "@tanstack/react-query";
import { combineDays } from "@/components/week/useDayBoards";
import { lastUpdatedAt } from "@/hooks/useDataUpdatedAt";
import { lineupKeys } from "@/hooks/useLineupEditor";
import { matchupKeys } from "@/hooks/useMatchup";
import type { LineupState } from "@/types/lineup-editor";
import * as F from "./week-api-fixtures";

let client: QueryClient;
let unsubscribe = () => {};

afterEach(() => {
  unsubscribe();
  client.clear();
});

/** Later days' lineups as the Week desk reads them; each read answers a fresh copy of `boards[period]`. */
function laterDays(boards: Record<number, LineupState>) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const queries = Object.keys(boards).map((p) => ({
    queryKey: lineupKeys.day(3, Number(p)),
    queryFn: () => Promise.resolve(structuredClone(boards[Number(p)])),
  }));
  const combine = (results: QueryObserverResult[]) => combineDays(results as Array<QueryObserverResult<LineupState | null>>);
  // As useQueries wires it: the options (with `combine`) arrive through setQueries.
  const observer = new QueriesObserver<ReturnType<typeof combineDays>>(client, queries, { combine });
  observer.setQueries(queries, { combine });
  let renders = 0;
  unsubscribe = observer.subscribe(() => renders++);
  const read = () => observer.getOptimisticResult(queries, combine)[1]();
  return { observer, read, renders: () => renders, refetch: () => Promise.all(queries.map((q) => client.refetchQueries({ queryKey: q.queryKey }))) };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("the later days' lineups, combined", () => {
  test("a refetch that reads the same lineups keeps the same value: nothing below re-renders", async () => {
    const days = { 10: F.espnBoard(3), 11: F.espnBoard(4) };
    const q = laterDays(days);
    await settle();
    const first = q.read();
    expect(first.loading).toBe(false);
    expect(first.data.map((b) => b?.nba_date)).toEqual([F.DATES[3], F.DATES[4]]);
    const before = q.renders();
    await q.refetch();
    await settle();
    expect(q.read()).toBe(first);
    expect(q.renders()).toBe(before);
  });

  test("a day whose lineup changed is a new value; the unchanged day keeps its board", async () => {
    const days = { 10: F.espnBoard(3), 11: F.espnBoard(4) };
    const q = laterDays(days);
    await settle();
    const first = q.read();
    days[11] = { ...F.espnBoard(4), roster_version: "v-2" };
    await q.refetch();
    await settle();
    const next = q.read();
    expect(next).not.toBe(first);
    expect(next.data[0]).toBe(first.data[0]);
    expect(next.data[1]?.roster_version).toBe("v-2");
  });
});

describe("lastUpdatedAt", () => {
  test("the newest answer among the watched queries; null before any", () => {
    client = new QueryClient();
    const keys = [matchupKeys.week(3), matchupKeys.live(3)];
    expect(lastUpdatedAt(client, keys)).toBeNull();
    client.setQueryData(matchupKeys.week(3), F.weekOf(), { updatedAt: 1_000 });
    client.setQueryData(matchupKeys.live(3), F.live(F.current()), { updatedAt: 5_000 });
    client.setQueryData(matchupKeys.live(4), F.live(F.current()), { updatedAt: 9_000 });
    expect(lastUpdatedAt(client, keys)).toBe(5_000);
  });
});
