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
  localizeProseClocks,
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

  test("in a browser it is the browser's zone, and the formatters use it by default", () => {
    // bun test runs in UTC (unless TZ is set), so this tells the browser's zone from Eastern.
    // A stand-in window makes this a browser.
    const g = globalThis as { window?: unknown };
    const had = "window" in g;
    const before = g.window;
    g.window = {};
    try {
      const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
      expect(viewerZone()).toBe(browser);
      expect(localTip("19:30", "2026-11-05")).toBe(localTip("19:30", "2026-11-05", { tz: browser }));
    } finally {
      if (had) g.window = before;
      else delete g.window;
    }
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
    expect(localTip("25:90", "2026-11-05", { tz: CHI })).toBe("25:90");
    expect(etInstant("2026-11-05", "24:00")).toBeNull();
    expect(etInstant("2026-02-30", "19:00")).toBeNull();
    // An impossible date reads on today's, like a missing one.
    expect(localTip("19:30", "2026-02-30", { tz: CHI })).toBe("6:30 PM");
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

describe("localizeProseClocks", () => {
  test("moves Dime's Eastern clocks to the viewer's zone, with its name", () => {
    expect(localizeProseClocks("Brunson tips at 7:30 PM ET against Boston.", "2026-11-05", { tz: CHI })).toBe(
      "Brunson tips at 6:30 PM CST against Boston."
    );
    expect(localizeProseClocks("first tip 7:00 PM ET, last 10:30 PM ET", "2026-11-05", { tz: LA })).toBe(
      "first tip 4:00 PM PST, last 7:30 PM PST"
    );
  });

  test("reads the ways the time gets written", () => {
    expect(localizeProseClocks("at 7 pm ET", "2026-11-05", { tz: CHI })).toBe("at 6:00 PM CST");
    expect(localizeProseClocks("at 7:30 p.m. Eastern", "2026-11-05", { tz: CHI })).toBe("at 6:30 PM CST");
    expect(localizeProseClocks("at 7:30PM EST", "2026-11-05", { tz: CHI })).toBe("at 6:30 PM CST");
    expect(localizeProseClocks("window opens 18:55 ET", "2026-11-05", { tz: CHI })).toBe("window opens 5:55 PM CST");
    expect(localizeProseClocks("the day turns at 3 AM ET", "2026-11-05", { tz: LA })).toBe("the day turns at 12:00 AM PST");
  });

  test("a clock past the viewer's midnight names the day", () => {
    expect(localizeProseClocks("tips at 7:00 PM ET", "2026-11-04", { tz: PARIS })).toBe("tips at Thu 1:00 AM GMT+1");
  });

  test("an Eastern viewer reads it as written", () => {
    expect(localizeProseClocks("tips at 7:30 PM ET", "2026-11-05", { tz: ET_ZONE })).toBe("tips at 7:30 PM ET");
    expect(localizeProseClocks("tips at 7:30 PM ET", "2026-11-05", { tz: "America/Detroit" })).toBe("tips at 7:30 PM ET");
  });

  test("daylight saving follows the date", () => {
    // Nov 1 2026 ends US daylight time; Phoenix never keeps it
    expect(localizeProseClocks("7:00 PM ET", "2026-10-30", { tz: PHX })).toBe("4:00 PM MST");
    expect(localizeProseClocks("7:00 PM ET", "2026-11-05", { tz: PHX })).toBe("5:00 PM MST");
  });

  test("leaves bare clocks, scores and other numbers alone", () => {
    const text = "He scored 31 at 7:30 PM, Q3 5:23 left, 12 of 20 from the field, 3:1 odds, 10 PM Pacific.";
    expect(localizeProseClocks(text, "2026-11-05", { tz: CHI })).toBe(text);
    expect(localizeProseClocks("13:00 ET", "2026-11-05", { tz: CHI })).toBe("12:00 PM CST");
    expect(localizeProseClocks("25:00 ET", "2026-11-05", { tz: CHI })).toBe("25:00 ET");
    // No AM/PM and not plainly 24-hour: it could be a PM tip, so it stays as written
    expect(localizeProseClocks("tips 7:30 ET, or 10:30 ET", "2026-11-05", { tz: CHI })).toBe("tips 7:30 ET, or 10:30 ET");
    expect(localizeProseClocks("07:30 ET", "2026-11-05", { tz: CHI })).toBe("6:30 AM CST");
    expect(localizeProseClocks("", "2026-11-05", { tz: CHI })).toBe("");
  });
});
