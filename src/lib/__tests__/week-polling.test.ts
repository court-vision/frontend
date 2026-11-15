import { describe, expect, test } from "bun:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { LIVE_TICK } from "../live-beat";
import {
  ACTIONS_FAST,
  ACTIONS_SLOW,
  LINEUP_FAST,
  LINEUP_SLOW,
  LIVE_FAST,
  LIVE_SLOW,
  actionsPollMs,
  etInstant,
  gameOn,
  lineupPollMs,
  liveSpan,
  livePollMs,
  lockSpan,
  lockTimes,
  readLiveMatchup,
} from "../week-polling";
import type { LiveMatchupData } from "@/types/matchup";
import * as F from "./week-api-fixtures";

const MIN = 60_000;
/** An instant from ET wall time on the fixtures' today (Wednesday 2026-10-28, EDT). */
const et = (hhmm: string, date: string = F.DATES[F.TODAY]) => etInstant(date, hhmm)!;

describe("etInstant", () => {
  test("reads ET wall times on either side of the DST change", () => {
    expect(new Date(et("19:00")).toISOString()).toBe("2026-10-28T23:00:00.000Z");
    // 2026-11-01 is the Sunday clocks fall back: an evening tip is EST.
    expect(new Date(et("18:00", "2026-11-01")).toISOString()).toBe("2026-11-01T23:00:00.000Z");
    expect(new Date(et("22:30", "2026-12-25")).toISOString()).toBe("2026-12-26T03:30:00.000Z");
    expect(new Date(et("19:30", "2027-03-14")).toISOString()).toBe("2027-03-14T23:30:00.000Z");
  });

  test("an unreadable date or time is no instant", () => {
    expect(etInstant(null, "19:00")).toBeNull();
    expect(etInstant("2026-10-28", null)).toBeNull();
    expect(etInstant("10/28/2026", "19:00")).toBeNull();
    expect(etInstant("2026-10-28", "TBD")).toBeNull();
  });
});

describe("tonight's windows from the board", () => {
  // Wednesday: Jokic and Sengun (IR, still locks) 19:00, Haliburton 19:30, SGA and Wembanyama 20:30.
  const board = F.espnBoard();
  const idle = F.MINE.map((s) => ({ ...s, tips: s.tips.map((t, i) => (i === F.TODAY ? null : t)) }));

  test("each of your players with a game locks at his tip", () => {
    expect(lockTimes(board).sort()).toEqual([et("19:00"), et("19:00"), et("19:30"), et("20:30"), et("20:30")]);
    expect(lockSpan(board)).toEqual({ start: et("18:45"), end: et("20:32") });
  });

  test("the live window runs from 15 min before your first tip to 30 min after your last", () => {
    expect(liveSpan(board)).toEqual({ start: et("18:45"), end: et("21:00") });
    // A 13:00 matinee elsewhere on the slate doesn't open it: none of yours plays in it.
    expect(liveSpan(F.espnBoard(F.TODAY, { first: "13:00" }))).toEqual({ start: et("18:45"), end: et("21:00") });
  });

  test("a day none of yours plays has no window, whoever else does", () => {
    const offBoard = F.espnBoard(F.TODAY, { roster: idle });
    expect(lockSpan(offBoard)).toBeNull();
    expect(liveSpan(offBoard)).toBeNull();
  });

  test("a game whose tip isn't known yet opens no window (its box score will)", () => {
    const untimed = F.espnBoard();
    untimed.players = untimed.players.map((p) => ({ ...p, game_time_et: null }));
    expect(untimed.players.some((p) => p.has_game_today)).toBe(true);
    expect(liveSpan(untimed)).toBeNull();
  });

  test("no board (a Yahoo team, or one not read yet) has no clock window", () => {
    expect(liveSpan(null)).toBeNull();
    expect(lockSpan(null)).toBeNull();
    expect(liveSpan({ ...board, nba_date: null })).toBeNull();
  });
});

describe("livePollMs", () => {
  const span = liveSpan(F.espnBoard());
  const quiet = F.live(F.current());

  test("slow through the day, fast from 15 min before the first tip until the window closes", () => {
    expect(livePollMs(span, quiet, et("11:00"))).toBe(LIVE_SLOW);
    expect(livePollMs(span, quiet, et("18:45"))).toBe(LIVE_FAST);
    expect(livePollMs(span, quiet, et("20:59"))).toBe(LIVE_FAST);
    expect(livePollMs(span, quiet, et("21:01"))).toBe(LIVE_SLOW);
  });

  test("the read before the window is timed to land as it opens", () => {
    const now = et("18:42");
    expect(now + livePollMs(span, quiet, now)).toBe(et("18:45"));
    // Never a tight loop on a window about to open.
    expect(livePollMs(span, quiet, et("18:45") - 1_000)).toBe(5_000);
  });

  test("a rostered game in progress keeps it fast at any hour, either side", () => {
    const mineLive = F.live(F.current(), { [F.MINE[2].id]: F.liveStats(1628983, 2, 18) });
    const theirsLive = F.live(F.current(), { [F.THEIRS[1].id]: F.liveStats(1641706, 2, 9) });
    expect(gameOn(mineLive)).toBe(true);
    expect(livePollMs(span, mineLive, et("23:10"))).toBe(LIVE_FAST);
    expect(livePollMs(null, theirsLive, et("23:10"))).toBe(LIVE_FAST);
  });

  test("a matinee only the opponent plays in: slow until its first box score is live, then fast", () => {
    const matinee = liveSpan(F.espnBoard(F.TODAY, { first: "13:00" }));
    const tipped = F.live(F.current(), { [F.THEIRS[1].id]: F.liveStats(1641706, 2, 4) });
    expect(livePollMs(matinee, quiet, et("12:50"))).toBe(LIVE_SLOW);
    expect(livePollMs(matinee, quiet, et("13:03"))).toBe(LIVE_SLOW);
    expect(livePollMs(matinee, tipped, et("13:05"))).toBe(LIVE_FAST);
    // Over: slow again until your own window opens.
    const over = F.live(F.current(), { [F.THEIRS[1].id]: F.liveStats(1641706, 3, 38) });
    expect(livePollMs(matinee, over, et("15:30"))).toBe(LIVE_SLOW);
  });

  test("final and not-started box scores don't", () => {
    const done = F.live(F.current(), { [F.MINE[0].id]: F.liveStats(203999, 3, 52), [F.THEIRS[1].id]: F.liveStats(1641706, 1, 0) });
    expect(gameOn(done)).toBe(false);
    expect(livePollMs(span, done, et("23:10"))).toBe(LIVE_SLOW);
  });

  test("without a window (preseason, Yahoo, an off day) it is slow, never off", () => {
    expect(livePollMs(null, quiet, et("19:30"))).toBe(LIVE_SLOW);
    expect(livePollMs(null, undefined, et("19:30"))).toBe(LIVE_SLOW);
    // Preseason: the board is opening night's, a week ahead.
    const opening = liveSpan(F.espnBoard(0));
    expect(livePollMs(opening, quiet, etInstant("2026-10-21", "19:30")!)).toBe(LIVE_SLOW);
  });
});

describe("livePollMs on the beat", () => {
  const span = liveSpan(F.espnBoard());
  const boxes = { [F.MINE[2].id]: F.liveStats(1628983, 2, 18) };

  test("while rostered box scores are being written, the read lands a second after the next write", () => {
    // Answered at 20:00:01 with a write one second old: the next is due at 20:00:15, read at :16.
    const readAt = et("20:00") + 1_000;
    const written = F.live(F.current(), boxes, { liveAgeMs: 1_000 });
    expect(livePollMs(span, written, readAt, readAt)).toBe(15_000);
    // Asked again four seconds on (the timer is re-armed on every state change), it names the same moment.
    expect(livePollMs(span, written, readAt + 4_000, readAt)).toBe(11_000);
    // An opponent's matinee with no window of yours: the box scores alone put it on the beat.
    expect(livePollMs(null, written, readAt, readAt)).toBe(15_000);
  });

  test("with no write to read by it is the 30 s pace around rostered games, as before", () => {
    const at = et("20:00");
    // Before the first box score of the night.
    expect(livePollMs(span, F.live(F.current()), at, at)).toBe(LIVE_FAST);
    // The pipeline has stopped under a game still marked live.
    expect(livePollMs(span, F.live(F.current(), boxes, { liveAgeMs: 600_000 }), at, at)).toBe(LIVE_FAST);
    expect(livePollMs(null, F.live(F.current(), boxes, { liveAgeMs: 600_000 }), et("23:10"), et("23:10"))).toBe(LIVE_FAST);
    // An answer whose arrival isn't known (the callers before the beat) is read as it was.
    expect(livePollMs(span, F.live(F.current(), boxes, { liveAgeMs: 1_000 }), at)).toBe(LIVE_FAST);
  });

  test("games over and settled: slow again", () => {
    const done = F.live(F.current(), { [F.MINE[0].id]: F.liveStats(203999, 3, 52) }, { liveAgeMs: 2 * 3_600_000 });
    expect(livePollMs(span, done, et("23:40"), et("23:40"))).toBe(LIVE_SLOW);
  });
});

describe("readLiveMatchup", () => {
  const KEY = ["matchups", "live", 7] as const;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /** A mounted live matchup whose server stamps each provider read; `asked` is what each read handed back. */
  function desk(slow = 0) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const asked: Array<number | undefined> = [];
    let stamp = 1_000;
    const read = async (reuseFrom: number | undefined): Promise<LiveMatchupData> => {
      asked.push(reuseFrom);
      await wait(slow);
      // The server reads the provider unless the caller's stamp lets it reuse its own.
      if (reuseFrom === undefined) stamp += 1;
      return F.live(F.current(), {}, { liveAgeMs: 1_000, providerReadMs: stamp });
    };
    const observer = new QueryObserver<LiveMatchupData>(client, {
      queryKey: KEY,
      staleTime: LIVE_TICK,
      queryFn: () => readLiveMatchup(client, KEY, read),
    });
    const stop = observer.subscribe(() => {});
    const done = () => {
      stop();
      client.clear();
    };
    return { client, observer, asked, done };
  }

  test("a first read hands nothing back; a poll hands back the stamp it holds", async () => {
    const { observer, asked, done } = desk();
    await wait(5);
    expect(asked).toEqual([undefined]);
    await observer.refetch();
    await observer.refetch();
    expect(asked).toEqual([undefined, 1_001, 1_001]);
    done();
  });

  test("after a move the provider is read again, and the polls after it hand back the new stamp", async () => {
    const { client, observer, asked, done } = desk();
    await wait(5);
    await client.invalidateQueries({ queryKey: KEY });
    expect(asked).toEqual([undefined, undefined]);
    await observer.refetch();
    expect(asked).toEqual([undefined, undefined, 1_002]);
    done();
  });

  test("a move's re-read that joins a read over the old rosters gets the provider read after all", async () => {
    const { client, observer, asked, done } = desk(20);
    await wait(40);
    expect(asked).toEqual([undefined]);
    const poll = observer.refetch();                                  // box scores over the read it holds
    await wait(5);
    await client.invalidateQueries({ queryKey: KEY }, { cancelRefetch: false });   // a catch-up read joins it
    await poll;
    expect(asked).toEqual([undefined, 1_001, undefined]);
    expect(observer.getCurrentResult().data?.provider_read_ms).toBe(1_002);
    expect(client.getQueryState(KEY)?.isInvalidated).toBe(false);
    done();
  });

  test("a read that fails after a move leaves the next one still asking the provider", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const asked: Array<number | undefined> = [];
    let down = false;
    const read = async (reuseFrom: number | undefined): Promise<LiveMatchupData> => {
      asked.push(reuseFrom);
      if (down) throw new Error("ESPN is down");
      return F.live(F.current(), {}, { providerReadMs: 1_001 });
    };
    const observer = new QueryObserver<LiveMatchupData>(client, { queryKey: KEY, queryFn: () => readLiveMatchup(client, KEY, read) });
    const stop = observer.subscribe(() => {});
    await wait(5);
    down = true;
    await client.invalidateQueries({ queryKey: KEY });
    down = false;
    await observer.refetch();
    expect(asked).toEqual([undefined, undefined, undefined]);
    stop();
    client.clear();
  });
});

describe("lineupPollMs", () => {
  const board = F.espnBoard();

  test("every minute from 15 min before your first tip until your last player has locked", () => {
    expect(lineupPollMs(board, et("18:45"))).toBe(LINEUP_FAST);
    expect(lineupPollMs(board, et("20:31"))).toBe(LINEUP_FAST);
    expect(lineupPollMs(board, et("20:33"))).toBe(LINEUP_SLOW);
  });

  test("slow otherwise, the read before the window landing as it opens", () => {
    expect(lineupPollMs(board, et("09:00"))).toBe(LINEUP_SLOW);
    expect(et("18:38") + (lineupPollMs(board, et("18:38")) as number)).toBe(et("18:45"));
    const idle = F.espnBoard(F.TODAY, { roster: F.MINE.map((s) => ({ ...s, tips: s.tips.map(() => null) })) });
    expect(lineupPollMs(idle, et("19:30"))).toBe(LINEUP_SLOW);
  });

  test("a board that can't be written isn't polled", () => {
    expect(lineupPollMs(F.espnBoard(F.TODAY, { canWrite: false }), et("19:30"))).toBe(false);
    expect(lineupPollMs(null, et("19:30"))).toBe(false);
    expect(lineupPollMs(undefined, et("19:30"))).toBe(false);
  });
});

describe("actionsPollMs", () => {
  const board = F.espnBoard();

  test("every 5 min while your players lock, every 15 otherwise", () => {
    expect(actionsPollMs(board, et("19:15"))).toBe(ACTIONS_FAST);
    expect(actionsPollMs(board, et("22:00"))).toBe(ACTIONS_SLOW);
    expect(actionsPollMs(board, et("10:00"))).toBe(ACTIONS_SLOW);
    expect(et("18:35") + actionsPollMs(board, et("18:35"))).toBe(et("18:45"));
    expect(actionsPollMs(null, et("19:15"))).toBe(ACTIONS_SLOW);
  });
});

describe("what a quiet hour costs", () => {
  // Reads per visible hour away from games: 120 live, 60 lineup and 12 moves before.
  test("live 12, lineup 6, moves 4", () => {
    const board = F.espnBoard();
    const hour = 60 * MIN;
    expect(hour / livePollMs(null, F.live(F.current()), et("11:00"))).toBe(12);
    expect(hour / (lineupPollMs(board, et("11:00")) as number)).toBe(6);
    expect(hour / actionsPollMs(board, et("11:00"))).toBe(4);
  });
});
