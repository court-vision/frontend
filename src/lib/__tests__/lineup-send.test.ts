import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryObserver, type QueryKey } from "@tanstack/react-query";
import {
  sendLineupDays,
  settleLineupWrites,
  writeLineupDay,
  type SendResult,
  type SendStep,
} from "@/components/week/lineup-send";
import { lineupKeys } from "@/hooks/useLineupEditor";
import { matchupKeys } from "@/hooks/useMatchup";
import { ApiError, ROSTER_STALE, ROSTER_WRITE_REJECTED } from "@/lib/api-error";
import { diff, normalize, type Staged } from "@/lib/lineup-editor";
import type { ApplyLineupMovesData, ApplyLineupMovesRequest, LineupState } from "@/types/lineup-editor";
import { MOCK_LINEUP_STATE } from "../../__fixtures__/lineupState";

// The week: day 0 is ESPN's today (scoring period 20), days 1-6 are the later days the desk reads.
const TEAM = 7;
const TODAY = 20;
const DAYS = 7;
const periodOf = (day: number) => TODAY + day;

// Two bench players with games and the UT starters they swap with.
const BENCH_A = 4432639, UT_A = 6450;
const BENCH_B = 4066261, UT_B = 4869342;
const UT = 11, BE = 12;
const SWAP_A: Staged = { [BENCH_A]: UT, [UT_A]: BE };
const SWAP_B: Staged = { [BENCH_B]: UT, [UT_B]: BE };

type Slots = Map<number, number>;

const tick = () => new Promise((r) => setTimeout(r, 0));

/**
 * ESPN behind the backend, as far as a send sees it: one lineup per day, an
 * edit carrying forward to later days until the next day with its own edit,
 * every write checked against the roster version of that day's lineup now and
 * answered with a re-read of the day (backend `apply_manual`). Every request
 * the desk makes is logged; `espnReads` counts the ESPN reads behind them
 * (a lineup GET is one, a write two for today and three for a later day).
 */
function fakeEspn() {
  const base: Slots = new Map(MOCK_LINEUP_STATE.players.map((p) => [p.player_id, p.lineup_slot_id]));
  const edits = new Map<number, Slots>();
  const held = new Map<number, Promise<void>>();
  const log: string[] = [];
  let espnReads = 0;
  let writes = 0;

  const slotsOn = (period: number): Slots => {
    let at = -1;
    for (const p of edits.keys()) if (p <= period && p > at) at = p;
    return new Map(at >= 0 ? edits.get(at)! : base);
  };
  const boardOn = (period: number): LineupState => {
    const slots = slotsOn(period);
    const pairs = [...slots].sort(([a], [b]) => a - b).map(([id, s]) => `${id}:${s}`);
    return {
      ...MOCK_LINEUP_STATE,
      scoring_period_id: period,
      current_scoring_period_id: TODAY,
      nba_date: `2026-10-${period}`,
      players: MOCK_LINEUP_STATE.players.map((p) => ({ ...p, lineup_slot_id: slots.get(p.player_id)! })),
      roster_version: `${period}|${pairs.join(",")}`,
      fetched_at: `2026-10-${TODAY}T19:00:${String(espnReads % 60).padStart(2, "0")}-04:00`,
    };
  };

  return {
    log,
    boardOn,
    espnReads: () => espnReads,
    /** Forget the requests so far (the desk's first load). */
    reset() {
      log.length = 0;
      espnReads = 0;
    },
    /** Days ESPN refuses a write for. */
    refuse: new Set<number>(),
    /** Days whose re-read after the write fails: the board from before the write comes back, unverified. */
    unverified: new Set<number>(),
    /** Edit a day on ESPN directly (the app, another tab): the desk's board for it goes stale. */
    editElsewhere(period: number, staged: Staged) {
      const slots = slotsOn(period);
      for (const [id, slot] of Object.entries(staged)) slots.set(Number(id), slot);
      edits.set(period, slots);
    },
    /** Hold reads of a day until the returned release is called; they answer with the lineup as it was asked for. */
    hold(period: number) {
      let release = () => {};
      held.set(period, new Promise<void>((r) => (release = r)));
      return () => {
        held.delete(period);
        release();
      };
    },
    /** GET /teams/{id}/lineup[?scoring_period_id=]. */
    async read(period?: number): Promise<LineupState> {
      log.push(period == null ? "GET lineup" : `GET lineup ${period}`);
      espnReads += 1;
      const board = boardOn(period ?? TODAY);
      await (held.get(period ?? TODAY) ?? tick());
      return board;
    },
    /** POST /teams/{id}/lineup/moves. */
    async post(body: ApplyLineupMovesRequest): Promise<ApplyLineupMovesData> {
      const period = body.expected_scoring_period_id;
      log.push(`POST moves ${period}`);
      await tick();
      espnReads += period > TODAY ? 2 : 1;
      const before = boardOn(period);
      if (before.roster_version !== body.roster_version) {
        throw new ApiError({ status: 409, code: ROSTER_STALE, message: "Your lineup changed", data: { lineup: before } });
      }
      if (this.refuse.has(period)) {
        throw new ApiError({ status: 409, code: ROSTER_WRITE_REJECTED, message: "ESPN rejected the lineup change" });
      }
      const slots = slotsOn(period);
      for (const m of body.moves) slots.set(m.player_id, m.to_slot_id);
      edits.set(period, slots);
      writes += 1;
      if (this.unverified.has(period)) return { lineup: before, applied_moves: [], verified: false, audit_id: writes };
      espnReads += 1;
      return { lineup: boardOn(period), applied_moves: [], verified: true, audit_id: writes };
    },
    /** Any other read the desk shows the roster through. */
    async other(name: string) {
      log.push(`GET ${name}`);
      await tick();
      return { name };
    },
  };
}

type Espn = ReturnType<typeof fakeEspn>;

let client: QueryClient;
let unsubscribe: Array<() => void> = [];

afterEach(() => {
  unsubscribe.forEach((u) => u());
  unsubscribe = [];
  client.clear();
});

/** Until no read is in flight. */
async function idle() {
  for (let i = 0; i < 50 && (i < 2 || client.isFetching() > 0); i++) await tick();
  expect(client.isFetching()).toBe(0);
}

/**
 * The Week desk's reads that a send touches, mounted as the desk mounts them:
 * today's lineup, the later days', today's moves, the live matchup and the week.
 */
async function desk(espn: Espn) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const watch = (queryKey: QueryKey, queryFn: () => Promise<unknown>, staleTime: number) => {
    const observer = new QueryObserver(client, { queryKey, queryFn, staleTime });
    unsubscribe.push(observer.subscribe(() => {}));
  };
  watch(lineupKeys.state(TEAM), () => espn.read(), 30_000);
  for (let day = 1; day < DAYS; day++) watch(lineupKeys.day(TEAM, periodOf(day)), () => espn.read(periodOf(day)), 60_000);
  watch(lineupKeys.actions(TEAM), () => espn.other("actions"), 120_000);
  watch(matchupKeys.live(TEAM), () => espn.other("live"), 30_000);
  watch(matchupKeys.week(TEAM), () => espn.other("week"), 60_000);
  await idle();
  espn.reset();
}

const cached = (day: number) =>
  client.getQueryData<LineupState>(day === 0 ? lineupKeys.state(TEAM) : lineupKeys.day(TEAM, periodOf(day)));

/** useDayBoards' `refresh`: the day read again whatever the cache holds. */
const refresh = (espn: Espn) => (day: number) =>
  day === 0
    ? client.fetchQuery({ queryKey: lineupKeys.state(TEAM), queryFn: () => espn.read(), staleTime: 0 })
    : client.fetchQuery({ queryKey: lineupKeys.day(TEAM, periodOf(day)), queryFn: () => espn.read(periodOf(day)), staleTime: 0 });

/** The tray's send as WeekTerminal makes it: the boards on screen when it began, each day's staging re-diffed. */
async function send(espn: Espn, staged: Record<number, Staged>) {
  const boards = Array.from({ length: DAYS }, (_, day) => cached(day));
  const steps = Object.keys(staged)
    .map(Number)
    .sort((a, b) => a - b)
    .map((day) => ({ day, label: `day ${day}` }));
  const sending: Array<number | null> = [];
  let settled = -1;
  const result: SendResult<SendStep> = await sendLineupDays(steps, {
    board: (day) => boards[day],
    moves: (day, b) => diff(b, normalize(b, staged[day])),
    apply: (_day, b, moves) => writeLineupDay(client, TEAM, (body) => espn.post(body), b, moves),
    refresh: refresh(espn),
    settle: (sent, failed) => {
      settled = espn.log.length;
      settleLineupWrites(client, TEAM, sent, failed);
    },
    onSending: (day) => sending.push(day),
  });
  /** The requests the send made before its settle; the rest are the settle's. */
  return { ...result, sending, beforeSettle: espn.log.slice(0, settled), fromSettle: espn.log.slice(settled) };
}

/** How many of the log's requests start with `prefix`. */
const count = (espn: Espn, prefix: string) => espn.log.filter((r) => r.startsWith(prefix)).length;

/** Every day's cached board is the lineup ESPN holds for it. */
function expectDeskMatchesEspn(espn: Espn) {
  for (let day = 0; day < DAYS; day++) {
    expect({ day, version: cached(day)?.roster_version }).toEqual({ day, version: espn.boardOn(periodOf(day)).roster_version });
  }
}

describe("a 1-day send", () => {
  test("today: one write, no read before it, then each later day, today's moves, live and the week once", async () => {
    const espn = fakeEspn();
    await desk(espn);
    const { done, failed } = await send(espn, { 0: SWAP_A });
    await idle();

    expect(failed).toBeNull();
    expect(done.map((d) => d.day)).toEqual([0]);
    expect(espn.log[0]).toBe("POST moves 20");
    expect(count(espn, "POST")).toBe(1);
    // Today's board came back with the write; the later days inherited the edit and are read again.
    expect(count(espn, "GET lineup")).toBe(6);
    expect(espn.log).not.toContain("GET lineup");
    expect(count(espn, "GET actions")).toBe(1);
    expect(count(espn, "GET live")).toBe(1);
    expect(count(espn, "GET week")).toBe(1);
    expect(espn.log).toHaveLength(10);
    expectDeskMatchesEspn(espn);
  });

  test("a later day: the days before it stay, the day itself comes back with the write", async () => {
    const espn = fakeEspn();
    await desk(espn);
    const { failed } = await send(espn, { 3: SWAP_A });
    await idle();

    expect(failed).toBeNull();
    expect(espn.log[0]).toBe("POST moves 23");
    // Days 4-6 may have inherited the edit; days 1-2 can't have; day 3 is the write's own read.
    expect(espn.log.filter((r) => r.startsWith("GET lineup ")).sort()).toEqual(["GET lineup 24", "GET lineup 25", "GET lineup 26"]);
    // Today's board after a later day's write, as before.
    expect(count(espn, "GET lineup")).toBe(4);
    expect(espn.log).toHaveLength(8);
    expectDeskMatchesEspn(espn);
  });
});

describe("a 3-day send", () => {
  test("one write per day, each day after the first read once before its write, one wave of re-reads after the last", async () => {
    const espn = fakeEspn();
    await desk(espn);
    const invalidated: QueryKey[] = [];
    const invalidate = client.invalidateQueries.bind(client);
    client.invalidateQueries = ((filters, options) => {
      if (filters?.queryKey) invalidated.push(filters.queryKey);
      return invalidate(filters, options);
    }) as typeof client.invalidateQueries;

    const { done, failed, sending, beforeSettle } = await send(espn, { 0: SWAP_A, 2: SWAP_B, 4: { [BENCH_A]: BE, [UT_A]: UT } });
    await idle();

    expect(failed).toBeNull();
    expect(done.map((d) => d.day)).toEqual([0, 2, 4]);
    expect(sending).toEqual([0, 2, 4, null]);
    // The send itself: write, read the next day, write, read, write. Nothing else waited on.
    expect(beforeSettle).toEqual([
      "POST moves 20",
      "GET lineup 22",
      "POST moves 22",
      "GET lineup 24",
      "POST moves 24",
    ]);
    // Then one wave: the later days the writes didn't return, today's board, today's moves, live, the week.
    const wave = espn.log.slice(beforeSettle.length);
    expect(wave.filter((r) => r.startsWith("GET lineup ")).sort()).toEqual([
      "GET lineup 21",
      "GET lineup 23",
      "GET lineup 25",
      "GET lineup 26",
    ]);
    expect(wave.filter((r) => !r.startsWith("GET lineup ")).sort()).toEqual(["GET actions", "GET lineup", "GET live", "GET week"]);
    expect(invalidated.filter((k) => k[1] === "day")).toHaveLength(1);
    expect(invalidated.filter((k) => k[1] === "actions")).toHaveLength(1);
    expect(espn.log).toHaveLength(13);
    // Lineup reads on ESPN: two per write for today and three for a later day, one per GET.
    expect(espn.espnReads()).toBe(2 + 1 + 3 + 1 + 3 + (4 + 1));
    expectDeskMatchesEspn(espn);
  });

  test("each write is checked against the lineup ESPN holds for its day after the earlier days' writes", async () => {
    const espn = fakeEspn();
    await desk(espn);
    const todayBefore = cached(0)!.roster_version;
    const before = cached(2)!.roster_version;
    const reads: LineupState[] = [];
    const posted: ApplyLineupMovesRequest[] = [];
    const read = espn.read.bind(espn);
    const post = espn.post.bind(espn);
    espn.read = async (period) => {
      const board = await read(period);
      reads.push(board);
      return board;
    };
    espn.post = async (body) => {
      posted.push(body);
      return post(body);
    };

    const { failed } = await send(espn, { 0: SWAP_A, 2: SWAP_B });
    const reread = reads[0];
    await idle();

    expect(failed).toBeNull();
    // Day 2 was read again after today's write and had inherited it, so its version moved;
    // its write went with the new one (the server would have answered ROSTER_STALE to the old).
    expect(reread.scoring_period_id).toBe(22);
    expect(reread.players.find((p) => p.player_id === BENCH_A)!.lineup_slot_id).toBe(UT);
    expect(reread.roster_version).not.toBe(before);
    expect(posted.map((b) => [b.expected_scoring_period_id, b.roster_version])).toEqual([
      [20, todayBefore],
      [22, reread.roster_version],
    ]);
    // Carry-forward on ESPN: day 1 has today's edit only; day 2 and the days after it have both.
    const slotOn = (period: number, id: number) => espn.boardOn(period).players.find((p) => p.player_id === id)!.lineup_slot_id;
    expect([slotOn(21, BENCH_A), slotOn(21, BENCH_B)]).toEqual([UT, BE]);
    expect([slotOn(22, BENCH_A), slotOn(22, BENCH_B)]).toEqual([UT, UT]);
    expect([slotOn(26, BENCH_A), slotOn(26, BENCH_B)]).toEqual([UT, UT]);
    expectDeskMatchesEspn(espn);
  });

  test("a day the earlier write already lined up is read again, sends nothing, and is done", async () => {
    const espn = fakeEspn();
    await desk(espn);
    const { done, failed } = await send(espn, { 0: SWAP_A, 2: SWAP_A });
    await idle();

    expect(failed).toBeNull();
    expect(done.map((d) => d.day)).toEqual([0, 2]);
    expect(count(espn, "POST")).toBe(1);
    expect(espn.log.slice(0, 2)).toEqual(["POST moves 20", "GET lineup 22"]);
    expectDeskMatchesEspn(espn);
  });
});

describe("a write", () => {
  test("resolves with its board without waiting for the later days' re-reads, which go out with the send's settle", async () => {
    const espn = fakeEspn();
    await desk(espn);
    const releases = [21, 22, 23, 24, 25, 26].map((p) => espn.hold(p));

    const sent = await writeLineupDay(client, TEAM, (body) => espn.post(body), cached(0)!, diff(cached(0)!, SWAP_A));
    expect(sent.verified).toBe(true);
    expect(cached(0)).toEqual(sent.lineup);
    expect(espn.log).toEqual(["POST moves 20"]);
    expect(client.isFetching()).toBe(0);

    settleLineupWrites(client, TEAM, [sent]);
    // Settling only starts the reads: they are still out (held) when it returns.
    expect(client.isFetching()).toBeGreaterThan(0);
    expect(count(espn, "GET lineup 2")).toBe(6);

    releases.forEach((r) => r());
    await idle();
    expectDeskMatchesEspn(espn);
  });

  test("calls off a read of its day that went out before it, so the old lineup doesn't land over the new one", async () => {
    const espn = fakeEspn();
    await desk(espn);
    // A focus refetch of day 3 is out when the send begins, and answers slowly.
    const release = espn.hold(23);
    const inFlight = client.refetchQueries({ queryKey: lineupKeys.day(TEAM, 23) });
    await tick();

    const sent = await writeLineupDay(client, TEAM, (body) => espn.post(body), cached(3)!, diff(cached(3)!, SWAP_A));
    release();
    await inFlight;
    await idle();

    expect(cached(3)).toEqual(sent.lineup);
    expect(cached(3)!.roster_version).toBe(espn.boardOn(23).roster_version);
  });

  test("calls off a poll of today's lineup that went out before it, so the old lineup doesn't land over the new one", async () => {
    const espn = fakeEspn();
    await desk(espn);
    // Today's minute poll is out when the send begins, and answers slowly. Today's
    // board lives under its own key, outside the later days' call-off.
    const release = espn.hold(TODAY);
    const inFlight = client.refetchQueries({ queryKey: lineupKeys.state(TEAM), exact: true });
    await tick();

    const sent = await writeLineupDay(client, TEAM, (body) => espn.post(body), cached(0)!, diff(cached(0)!, SWAP_A));
    release();
    await inFlight;
    await idle();

    expect(cached(0)).toEqual(sent.lineup);
    expect(cached(0)!.roster_version).toBe(espn.boardOn(TODAY).roster_version);
  });

  test("an unverified write's board is read again with the rest", async () => {
    const espn = fakeEspn();
    espn.unverified.add(23);
    await desk(espn);
    const { failed } = await send(espn, { 3: SWAP_A });
    await idle();

    expect(failed).toBeNull();
    expect(espn.log.filter((r) => r.startsWith("GET lineup ")).sort()).toEqual([
      "GET lineup 23",
      "GET lineup 24",
      "GET lineup 25",
      "GET lineup 26",
    ]);
    expectDeskMatchesEspn(espn);
  });
});

describe("a send that fails part way", () => {
  test("a refused day stops the send; the days before it stay written and the later days are read again", async () => {
    const espn = fakeEspn();
    espn.refuse.add(22);
    await desk(espn);
    const { done, failed, sending } = await send(espn, { 0: SWAP_A, 2: SWAP_B, 4: { [BENCH_A]: BE, [UT_A]: UT } });
    await idle();

    expect(done.map((d) => d.day)).toEqual([0]);
    expect(failed?.step.day).toBe(2);
    expect((failed?.error as ApiError).code).toBe(ROSTER_WRITE_REJECTED);
    expect(sending).toEqual([0, 2, null]);
    expect(count(espn, "POST")).toBe(2);
    expect(espn.log).not.toContain("POST moves 24");
    // Today's write went through, so every later day may have inherited it.
    expect(count(espn, "GET lineup 2")).toBe(1 + 6);
    expect(count(espn, "GET actions")).toBe(1);
    expectDeskMatchesEspn(espn);
  });

  test("a stale day caches the board the server hands back and reads every later day again", async () => {
    const espn = fakeEspn();
    await desk(espn);
    // Day 1 is edited on ESPN after the desk read it.
    espn.editElsewhere(21, SWAP_B);
    const { done, failed } = await send(espn, { 1: SWAP_A });
    await idle();

    expect(done).toEqual([]);
    expect((failed?.error as ApiError).code).toBe(ROSTER_STALE);
    expect(count(espn, "GET lineup 2")).toBe(6);
    // Nothing was written: the roster's other reads are left alone.
    expect(count(espn, "GET actions")).toBe(0);
    expectDeskMatchesEspn(espn);
  });

  test("a stale today caches the board the server hands back, so the retry goes with ESPN's version", async () => {
    const espn = fakeEspn();
    await desk(espn);
    // Today is edited on ESPN after the desk read it (the edit carries into the later days).
    espn.editElsewhere(TODAY, SWAP_B);
    const { done, failed } = await send(espn, { 0: SWAP_A });
    await idle();

    expect(done).toEqual([]);
    expect((failed?.error as ApiError).code).toBe(ROSTER_STALE);
    // Today isn't read again: the 409's board is the only thing that refreshes it
    // before the next minute's poll. The later days are.
    expect(espn.log[0]).toBe("POST moves 20");
    expect(espn.log).not.toContain("GET lineup");
    expect(espn.log.slice(1).sort()).toEqual([21, 22, 23, 24, 25, 26].map((p) => `GET lineup ${p}`));
    expectDeskMatchesEspn(espn);

    // Sending again goes through instead of answering 409 until the poll.
    espn.reset();
    const retry = await send(espn, { 0: SWAP_A });
    await idle();
    expect(retry.failed).toBeNull();
    expect(count(espn, "POST")).toBe(1);
    expectDeskMatchesEspn(espn);
  });

  test("a read that doesn't come back stops the send at that day and still reads the later days again", async () => {
    const espn = fakeEspn();
    await desk(espn);
    const read = espn.read.bind(espn);
    espn.read = async (period) => {
      if (period === 22) {
        espn.log.push(`GET lineup ${period}`);
        throw new ApiError({ status: 0, kind: "network", message: "Network request failed" });
      }
      return read(period);
    };
    const { done, failed, sending } = await send(espn, { 0: SWAP_A, 2: SWAP_B });
    await idle();

    expect(done.map((d) => d.day)).toEqual([0]);
    expect(failed?.step.day).toBe(2);
    expect(sending).toEqual([0, 2, null]);
    expect(count(espn, "POST")).toBe(1);
    expect(count(espn, "GET lineup 2")).toBe(1 + 6);
  });

  test("nothing written and nothing stale: nothing is read again", async () => {
    const espn = fakeEspn();
    espn.refuse.add(20);
    await desk(espn);
    const { done, failed } = await send(espn, { 0: SWAP_A });
    await idle();

    expect(done).toEqual([]);
    expect(failed?.step.day).toBe(0);
    expect(espn.log).toEqual(["POST moves 20"]);
  });
});
