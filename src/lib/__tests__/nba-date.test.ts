import { describe, expect, test } from "bun:test";
import { getTodayDate } from "../nba-date";

describe("getTodayDate: the NBA game date flips at 6 AM ET", () => {
  test("after midnight ET it is still last night", () => {
    // 04:03 EDT on Oct 21: the night of Oct 20, as the backend's live endpoints say.
    expect(getTodayDate(new Date("2026-10-21T08:03:00Z"))).toBe("2026-10-20");
    expect(getTodayDate(new Date("2026-10-21T09:59:59Z"))).toBe("2026-10-20");
  });

  test("from 6 AM ET it is the new day", () => {
    expect(getTodayDate(new Date("2026-10-21T10:00:00Z"))).toBe("2026-10-21");
    expect(getTodayDate(new Date("2026-10-21T23:30:00Z"))).toBe("2026-10-21");
    // 11 PM EDT is still that date, though UTC has rolled over.
    expect(getTodayDate(new Date("2026-10-22T03:00:00Z"))).toBe("2026-10-21");
  });

  test("on the hour in both offsets, across the fall-back night", () => {
    // Nov 1, 2026: 2 AM EDT becomes 1 AM EST. 05:30 EST is 10:30 UTC; 06:00 EST is 11:00 UTC.
    expect(getTodayDate(new Date("2026-11-01T10:30:00Z"))).toBe("2026-10-31");
    expect(getTodayDate(new Date("2026-11-01T11:00:00Z"))).toBe("2026-11-01");
    // In winter 6 AM EST is 11:00 UTC.
    expect(getTodayDate(new Date("2027-01-15T10:59:00Z"))).toBe("2027-01-14");
    expect(getTodayDate(new Date("2027-01-15T11:00:00Z"))).toBe("2027-01-15");
  });

  test("the year and the month roll back with the day", () => {
    expect(getTodayDate(new Date("2027-01-01T07:00:00Z"))).toBe("2026-12-31");
    expect(getTodayDate(new Date("2026-11-01T04:00:00Z"))).toBe("2026-10-31");
  });
});
