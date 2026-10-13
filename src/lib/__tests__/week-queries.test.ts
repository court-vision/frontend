import { afterEach, describe, expect, test } from "bun:test";
import { QueriesObserver, QueryClient, QueryObserver, type QueryObserverResult } from "@tanstack/react-query";
import { combineDays } from "@/components/week/useDayBoards";
import { lastUpdatedAt } from "@/hooks/useDataUpdatedAt";
import { lineupKeys } from "@/hooks/useLineupEditor";
import { matchupKeys } from "@/hooks/useMatchup";
import { ApiError } from "@/lib/api-error";
import { shareActions, shareLineup } from "@/lib/lineup-sharing";
import { DEMO_STREAMERS, demoDailyActions } from "@/lib/week-demo";
import { currentFallback } from "@/lib/week-source";
import type { DailyActionsData } from "@/types/daily-actions";
import type { LineupState } from "@/types/lineup-editor";
import type { LiveMatchupData, MatchupData } from "@/types/matchup";
import * as F from "./week-api-fixtures";

let client: QueryClient;
let unsubscribe = () => {};

afterEach(() => {
  unsubscribe();
  client.clear();
});

// Every read is stamped with the moment the server made it (`fetched_at`), as the backend does.
let reads = 0;
const stamped = <T extends LineupState>(board: T): T => ({
  ...structuredClone(board),
  fetched_at: `2026-10-28T19:${String(reads++ % 60).padStart(2, "0")}:00-04:00`,
});

/** Later days' lineups as useDayBoards reads them; each read answers a fresh, freshly stamped copy of `boards[period]`. */
function laterDays(boards: Record<number, LineupState>) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const queries = Object.keys(boards).map((p) => ({
    queryKey: lineupKeys.day(3, Number(p)),
    queryFn: () => Promise.resolve(stamped(boards[Number(p)])),
    structuralSharing: shareLineup,
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
  test("a refetch that reads the same lineups, stamped anew, keeps the same value: nothing below re-renders", async () => {
    const days = { 10: F.espnBoard(3), 11: F.espnBoard(4) };
    const q = laterDays(days);
    await settle();
    const first = q.read();
    expect(first.loading).toBe(false);
    expect(first.data.map((b) => b?.nba_date)).toEqual([F.DATES[3], F.DATES[4]]);
    const before = q.renders();
    await q.refetch();
    await settle();
    expect(client.getQueryState(lineupKeys.day(3, 10))?.dataUpdateCount).toBe(2);
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

/** One polled query as the desk subscribes to it: re-rendered only when what it reads (`data`, `isLoading`) changes. */
async function polled<T>(queryKey: readonly unknown[], read: () => T, structuralSharing: (prev: unknown, next: unknown) => unknown) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const observer = new QueryObserver<T>(client, { queryKey, queryFn: () => Promise.resolve(read()), structuralSharing, notifyOnChangeProps: ["data", "isLoading"] });
  let renders = 0;
  unsubscribe = observer.subscribe(() => renders++);
  await settle();
  return { observer, renders: () => renders, poll: () => observer.refetch() };
}

describe("a poll that reads the same answer, stamped anew", () => {
  test("today's lineup keeps the cached board, and its watcher doesn't re-render", async () => {
    const q = await polled(lineupKeys.state(3), () => stamped(F.espnBoard()), shareLineup);
    const first = q.observer.getCurrentResult().data;
    const before = q.renders();
    await q.poll();
    await settle();
    expect(client.getQueryState(lineupKeys.state(3))?.dataUpdateCount).toBe(2);
    expect(q.observer.getCurrentResult().data).toBe(first);
    expect(q.renders()).toBe(before);
  });

  test("today's lineup that changed is a new board", async () => {
    let version = "v-1";
    const q = await polled(lineupKeys.state(3), () => stamped({ ...F.espnBoard(), roster_version: version }), shareLineup);
    const first = q.observer.getCurrentResult().data;
    version = "v-2";
    await q.poll();
    expect(q.observer.getCurrentResult().data).not.toBe(first);
    expect(q.observer.getCurrentResult().data?.roster_version).toBe("v-2");
  });

  test("today's moves keep the cached answer though their board was read again", async () => {
    const answer = (): DailyActionsData => demoDailyActions(stamped(F.espnBoard()), DEMO_STREAMERS.slice(0, 5));
    const q = await polled(lineupKeys.actions(3), answer, shareActions);
    const first = q.observer.getCurrentResult().data;
    const before = q.renders();
    await q.poll();
    await settle();
    expect(q.observer.getCurrentResult().data).toBe(first);
    expect(q.renders()).toBe(before);
  });
});

/**
 * Live and its stand-in as LiveWeek wires them: every change to live's result
 * re-derives whether /matchups/current may run (`currentFallback`).
 */
function liveAndCurrent(answer: () => Promise<LiveMatchupData>) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let currentReads = 0;
  const live = new QueryObserver<LiveMatchupData>(client, { queryKey: matchupKeys.live(3), queryFn: answer });
  const currentOptions = () => ({
    queryKey: matchupKeys.detail(3, "season"),
    queryFn: () => {
      currentReads++;
      return Promise.resolve(F.current());
    },
    enabled: currentFallback(live.getCurrentResult()),
  });
  const current = new QueryObserver<MatchupData>(client, currentOptions());
  const offLive = live.subscribe(() => current.setOptions(currentOptions()));
  const offCurrent = current.subscribe(() => {});
  unsubscribe = () => {
    offLive();
    offCurrent();
  };
  return { live, current, reads: () => currentReads };
}

describe("the current matchup, read only as live's stand-in", () => {
  const boom = () => Promise.reject(new ApiError({ message: "Request failed (HTTP 500)", status: 500 }));

  test("not while live loads or answers", async () => {
    const q = liveAndCurrent(() => Promise.resolve(F.live(F.current())));
    expect(q.current.getCurrentResult().fetchStatus).toBe("idle");
    await settle();
    expect(q.live.getCurrentResult().data).toBeDefined();
    expect(q.reads()).toBe(0);
  });

  test("once live fails, and not again after live answers", async () => {
    let answer: () => Promise<LiveMatchupData> = boom;
    const q = liveAndCurrent(() => answer());
    await settle();
    await settle();
    expect(q.reads()).toBe(1);
    expect(q.current.getCurrentResult().data?.matchup_period).toBe(F.PERIOD);
    answer = () => Promise.resolve(F.live(F.current()));
    await q.live.refetch();
    expect(q.current.getCurrentResult().isEnabled).toBe(false);
    // A write invalidates the whole matchup family: the stand-in stays unread.
    await client.invalidateQueries({ queryKey: matchupKeys.all });
    await settle();
    expect(q.reads()).toBe(1);
  });

  test("not for an empty week", async () => {
    const q = liveAndCurrent(() => Promise.reject(ApiError.empty({ message: "No matchup" })));
    await settle();
    await settle();
    expect(q.live.getCurrentResult().isError).toBe(true);
    expect(q.reads()).toBe(0);
  });

  test("not when a poll fails after a good answer: live's rows stay", async () => {
    let answer: () => Promise<LiveMatchupData> = () => Promise.resolve(F.live(F.current()));
    const q = liveAndCurrent(() => answer());
    await settle();
    answer = boom;
    await q.live.refetch();
    await settle();
    expect(q.live.getCurrentResult().isError).toBe(true);
    expect(q.live.getCurrentResult().data).toBeDefined();
    expect(q.reads()).toBe(0);
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
