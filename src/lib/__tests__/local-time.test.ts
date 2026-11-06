import { describe, expect, test } from "bun:test";
import {
  ET_ZONE,
  etInstant,
  localClock,
  localDate,
  localDateTime,
  localStamp,
  localTip,
  localWeekdayTime,
  localizeEtClocks,
  viewerZone,
  zoneName,
} from "../local-time";

const CHI = "America/Chicago";
const LA = "America/Los_Angeles";
const PHX = "America/Phoenix";
const PARIS = "Europe/Paris";
const TOKYO = "Asia/Tokyo";

describe("viewerZone", () => {
  test("is Eastern with no browser, so server-rendered text reads as it always did", () => {
    expect(viewerZone()).toBe(ET_ZONE);
  });
});

describe("localTip", () => {
  test("moves an ET tip to the viewer's clock", () => {
    expect(localTip("19:30", "2026-11-05", { tz: ET_ZONE })).toBe("7:30 PM");
    expect(localTip("19:30", "2026-11-05", { tz: CHI })).toBe("6:30 PM");
    expect(localTip("22:00", "2026-11-05", { tz: LA })).toBe("7:00 PM");
    expect(localTip("12:00", "2026-11-05", { tz: CHI })).toBe("11:00 AM");
    expect(localTip("13:05", "2026-11-05", { tz: CHI })).toBe("12:05 PM");
  });

  test("the compact form for grid cells", () => {
    expect(localTip("19:30", "2026-11-05", { tz: CHI, compact: true })).toBe("6:30P");
    expect(localTip("10:00", "2026-11-05", { tz: LA, compact: true })).toBe("7:00A");
  });

  test("labels the zone as it stands on the game's date", () => {
    expect(localTip("19:30", "2026-11-05", { tz: CHI, label: true })).toBe("6:30 PM CST");
    expect(localTip("19:30", "2026-10-21", { tz: CHI, label: true })).toBe("6:30 PM CDT");
    expect(localTip("19:30", "2026-11-05", { tz: ET_ZONE, label: true })).toBe("7:30 PM EST");
  });

  test("a zone without daylight saving is two hours behind in winter, three in summer", () => {
    expect(localTip("19:00", "2027-01-10", { tz: PHX })).toBe("5:00 PM");
    expect(localTip("19:00", "2026-10-21", { tz: PHX })).toBe("4:00 PM");
  });

  test("Europe changes its clocks on another weekend than the US", () => {
    // 2026-10-25 Paris is back on CET while New York is still on EDT: five hours apart, not six.
    expect(localTip("19:30", "2026-10-28", { tz: PARIS, compact: true })).toBe("12:30A+1");
    expect(localTip("19:30", "2026-11-05", { tz: PARIS, compact: true })).toBe("1:30A+1");
  });

  test("a tip on the viewer's next calendar day says which day", () => {
    expect(localTip("19:30", "2026-11-04", { tz: PARIS })).toBe("Thu 1:30 AM");
    expect(localTip("19:30", "2026-11-04", { tz: TOKYO, label: true })).toBe("Thu 9:30 AM GMT+9");
    expect(localTip("19:30", "2026-11-04", { tz: TOKYO, compact: true })).toBe("9:30A+1");
  });

  test("passes through what it can't read", () => {
    expect(localTip(null, "2026-11-05", { tz: CHI })).toBe("");
    expect(localTip("", "2026-11-05", { tz: CHI })).toBe("");
    expect(localTip("TBD", "2026-11-05", { tz: CHI })).toBe("TBD");
  });

  test("without a date it reads on today's NBA date", () => {
    // Only the zone's offset on that date matters; Chicago is always an hour behind New York.
    expect(localTip("19:30", null, { tz: CHI })).toBe("6:30 PM");
    expect(localTip("19:30", "not a date", { tz: CHI })).toBe("6:30 PM");
  });

  test("agrees with etInstant", () => {
    const at = etInstant("2026-11-05", "19:30")!;
    expect(new Date(at).toISOString()).toBe("2026-11-06T00:30:00.000Z");
    expect(localClock(at, { tz: CHI })).toBe("6:30 PM");
    expect(localClock(at, { tz: "UTC", label: true })).toBe("12:30 AM UTC");
  });
});

describe("instants", () => {
  const at = Date.parse("2026-10-21T23:00:00Z"); // Wed 7:00 PM EDT

  test("weekday and clock", () => {
    expect(localWeekdayTime(at, { tz: ET_ZONE })).toBe("Wed 7:00 PM");
    expect(localWeekdayTime(at, { tz: LA, label: true })).toBe("Wed 4:00 PM PDT");
    expect(localWeekdayTime(at, { tz: TOKYO })).toBe("Thu 8:00 AM");
  });

  test("with the date", () => {
    expect(localDateTime(at, { tz: CHI })).toBe("Wed Oct 21, 6:00 PM");
    expect(localDateTime(at, { tz: CHI, label: true })).toBe("Wed Oct 21, 6:00 PM CDT");
  });

  test("the developer desk's 24-hour stamp", () => {
    const t = Date.parse("2026-10-07T23:41:09Z");
    expect(localStamp(t, "UTC")).toBe("Oct 7, 2026 23:41 UTC");
    expect(localStamp(t, CHI)).toBe("Oct 7, 2026 18:41 CDT");
    expect(localStamp(Date.parse("2026-10-08T04:05:00Z"), CHI)).toBe("Oct 7, 2026 23:05 CDT");
  });

  test("the viewer's calendar date", () => {
    const evening = Date.parse("2026-11-06T02:00:00Z"); // Nov 5, 8 PM in Chicago
    expect(localDate(evening, "UTC")).toBe("2026-11-06");
    expect(localDate(evening, CHI)).toBe("2026-11-05");
  });

  test("zone names", () => {
    expect(zoneName(at, CHI)).toBe("CDT");
    expect(zoneName(Date.parse("2026-12-01T12:00:00Z"), CHI)).toBe("CST");
    expect(zoneName(at, "UTC")).toBe("UTC");
  });
});

describe("localizeEtClocks", () => {
  test("moves the backend's ET clocks to the viewer's zone", () => {
    expect(localizeEtClocks("vs LAL · 7:30 PM", "2026-11-05", { tz: CHI })).toBe("vs LAL · 6:30 PM");
    expect(localizeEtClocks("vs LAL · 7:30 PM · PG over Jokic (no game today)", "2026-11-05", { tz: LA })).toBe(
      "vs LAL · 4:30 PM · PG over Jokic (no game today)"
    );
    expect(localizeEtClocks("Game at 10:30 PM", "2026-11-05", { tz: LA })).toBe("Game at 7:30 PM");
  });

  test("a clock marked ET keeps a zone, the viewer's", () => {
    expect(localizeEtClocks("first attempt 3:00 AM ET", "2026-11-05", { tz: CHI })).toBe("first attempt 2:00 AM CST");
  });

  test("a clock past the viewer's midnight names the day", () => {
    expect(localizeEtClocks("@ BOS · 7:00 PM", "2026-11-04", { tz: PARIS })).toBe("@ BOS · Thu 1:00 AM");
  });

  test("leaves text without a clock alone", () => {
    expect(localizeEtClocks("no game today", "2026-11-05", { tz: CHI })).toBe("no game today");
    expect(localizeEtClocks("OUT · frees PG", "2026-11-05", { tz: CHI })).toBe("OUT · frees PG");
    expect(localizeEtClocks("Q3 5:23", "2026-11-05", { tz: CHI })).toBe("Q3 5:23");
    expect(localizeEtClocks(null, "2026-11-05", { tz: CHI })).toBeNull();
    expect(localizeEtClocks(undefined)).toBeUndefined();
  });
});
