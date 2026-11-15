import { describe, expect, test } from "bun:test";
import { LATE_FOR, LATE_RETRY, LIVE_QUIET, LIVE_TICK, WRITE_MARGIN, liveReadMs, onLiveBeat } from "../live-beat";

/** Any moment on this clock: an answer that arrived then. */
const AT = 1_763_256_616_000;
const SEC = 1_000;

describe("liveReadMs", () => {
  test("reads a second after the next write is due", () => {
    // The answer's newest write was 1 s old: the next lands in 14 s, and is read in 15.
    expect(liveReadMs(1 * SEC, AT, AT)).toBe(15 * SEC);
    // A screen opened mid-tick joins the beat on its first answer.
    expect(liveReadMs(9_500, AT, AT)).toBe(6_500);
    expect(liveReadMs(0, AT, AT)).toBe(LIVE_TICK + WRITE_MARGIN);
  });

  test("names the same moment however often it is asked", () => {
    // TanStack re-arms the timer whenever the query's state changes: the target must not move.
    const target = AT + (liveReadMs(1 * SEC, AT, AT) as number);
    for (const later of [1, 4_000, 9_999, 14_000]) {
      expect(AT + later + (liveReadMs(1 * SEC, AT, AT + later) as number)).toBe(target);
    }
  });

  test("the viewer's clock being wrong changes nothing", () => {
    const wrong = AT - 7 * 3_600_000;
    expect(liveReadMs(1 * SEC, wrong, wrong + 4_000)).toBe(liveReadMs(1 * SEC, AT, AT + 4_000));
  });

  test("a write that hasn't landed is asked for again every 2 s, for 6 s", () => {
    // The read on the beat came back with the same write, now 16.1 s old.
    const late = (ageMs: number) => liveReadMs(ageMs, AT, AT) as number;
    expect(late(16_100)).toBe(1_900);
    expect(late(18_100)).toBe(1_900);
    expect(late(20_100)).toBe(1_900);
    // Reads at 16, 18, 20 and 22 s: the fourth is the last of them.
    expect(LIVE_TICK + WRITE_MARGIN + LATE_FOR).toBe(22 * SEC);
    expect(LATE_FOR / LATE_RETRY).toBe(3);
  });

  test("after that the run was skipped: one read a tick, a second after each write that is due", () => {
    // 22.1 s old: the next write is due at 30 s, read at 31.
    expect(liveReadMs(22_100, AT, AT)).toBe(8_900);
    expect(liveReadMs(31_100, AT, AT)).toBe(14_900);
    expect(liveReadMs(60 * SEC, AT, AT)).toBe(1 * SEC);
  });

  test("nothing written for 90 s is no beat", () => {
    expect(liveReadMs(LIVE_QUIET - 1, AT, AT)).not.toBeNull();
    expect(liveReadMs(LIVE_QUIET, AT, AT)).toBeNull();
    expect(liveReadMs(2 * 3_600 * SEC, AT, AT)).toBeNull();
    // An answer left on screen ages into it: a tab left for two minutes reads on its slow timer, or on focus.
    expect(liveReadMs(1 * SEC, AT, AT + 120 * SEC)).toBeNull();
  });

  test("no age, no beat", () => {
    expect(liveReadMs(null, AT, AT)).toBeNull();
    expect(liveReadMs(undefined, AT, AT)).toBeNull();      // an API that doesn't send it yet
    expect(liveReadMs(Number.NaN, AT, AT)).toBeNull();
    expect(liveReadMs(-5, AT, AT)).toBeNull();
    expect(liveReadMs(1 * SEC, 0, AT)).toBeNull();          // nothing has arrived
  });

  test("never a tight loop on a target a few milliseconds off", () => {
    expect(liveReadMs(LIVE_TICK + WRITE_MARGIN - 3, AT, AT)).toBe(250);
    expect(liveReadMs(LIVE_TICK + WRITE_MARGIN + LATE_RETRY - 3, AT, AT)).toBe(250);
  });

  test("a clock set back while the answer was on screen doesn't make the write younger", () => {
    expect(liveReadMs(5 * SEC, AT, AT - 60 * SEC)).toBe(11 * SEC);
  });
});

/**
 * A screen reading by `liveReadMs` against writes at `writes` (ms). Each read
 * is answered at once with the age of the newest write so far. Returns the
 * read times, and for each write how long after it landed it was first read.
 */
function follow(writes: number[], from: number, until: number) {
  const reads: number[] = [];
  let t = from;
  while (t <= until) {
    reads.push(t);
    const newest = Math.max(...writes.filter((w) => w <= t));
    const wait = liveReadMs(t - newest, t, t);
    if (wait == null) break;
    t += wait;
  }
  const seenAfter = writes
    .filter((w) => w >= from && w + LIVE_TICK <= until)
    .map((w) => (reads.find((r) => r >= w) as number) - w);
  return { reads, seenAfter };
}

describe("a night on the beat", () => {
  const TICKS = 40;
  // The job fires on the clock; its writes land 0.5 to 1.2 s later, differently each run.
  const jitter = (i: number) => 500 + ((i * 7919) % 700);
  const writes = Array.from({ length: TICKS }, (_, i) => i * LIVE_TICK + jitter(i));

  test("every write is on screen within about two seconds of landing, whenever the screen was opened", () => {
    for (const opened of [600, 4_321, 9_876, 14_999]) {
      const { reads, seenAfter } = follow(writes, opened, (TICKS - 1) * LIVE_TICK);
      // The first write after opening is caught on the next beat; from then on the screen is locked on.
      const locked = seenAfter.slice(1);
      expect(Math.max(...locked)).toBeLessThanOrEqual(2_200);
      expect(locked.reduce((a, b) => a + b, 0) / locked.length).toBeLessThan(1_500);
      // About one read a write: a late one costs a second ask, never a burst.
      expect(reads.length).toBeLessThan(TICKS * 1.4);
    }
  });

  test("a timer of its own at the same pace is 7.5 s behind on average", () => {
    // The comparison the beat is for: reads every 15 s from an arbitrary moment.
    const waits: number[] = [];
    for (let offset = 0; offset < LIVE_TICK; offset += 500) {
      const reads = Array.from({ length: TICKS }, (_, i) => offset + i * LIVE_TICK);
      for (const w of writes.slice(0, TICKS - 2)) waits.push((reads.find((r) => r >= w) as number) - w);
    }
    const mean = waits.reduce((a, b) => a + b, 0) / waits.length;
    expect(mean).toBeGreaterThan(7_000);
    expect(mean).toBeLessThan(8_000);
  });

  test("a run that fails costs three extra asks, then the screen waits for the next one", () => {
    const missing = writes.filter((_, i) => i !== 10);
    const { reads } = follow(missing, 600, 14 * LIVE_TICK);
    const during = reads.filter((r) => r > writes[9] + LIVE_TICK && r < writes[11]);
    expect(during.length).toBe(4);                                   // on the beat, then 2, 4 and 6 s later
    const next = reads.find((r) => r >= writes[11]) as number;
    expect(next - writes[11]).toBeLessThanOrEqual(2_200);
  });

  test("when the writes stop, so does the beat: a few reads, then none", () => {
    const { reads } = follow(writes.slice(0, 5), 600, 60 * LIVE_TICK);
    const after = reads.filter((r) => r > writes[4] + LIVE_TICK);
    expect(after.length).toBeLessThanOrEqual(9);
    expect(reads[reads.length - 1] - writes[4]).toBeLessThanOrEqual(LIVE_QUIET + LIVE_TICK);
  });
});

describe("onLiveBeat", () => {
  const answered = (data: { live_age_ms: number | null } | undefined, dataUpdatedAt = Date.now()) => ({ state: { data, dataUpdatedAt } });
  const pace = onLiveBeat<{ live_age_ms: number | null }>((d) => d?.live_age_ms, 60_000);

  test("on the beat while the pipeline writes, the screen's own timer otherwise", () => {
    const wait = pace(answered({ live_age_ms: 1_000 })) as number;
    expect(wait).toBeGreaterThan(14_900);
    expect(wait).toBeLessThanOrEqual(15_000);
    expect(pace(answered({ live_age_ms: null }))).toBe(60_000);
    expect(pace(answered({ live_age_ms: 3_600_000 }))).toBe(60_000);
    expect(pace(answered(undefined, 0))).toBe(60_000);
  });

  test("a screen with no timer of its own stays off without a beat", () => {
    const off = onLiveBeat<{ live_age_ms: number | null }>((d) => d?.live_age_ms, false);
    expect(off(answered({ live_age_ms: null }))).toBe(false);
  });
});
