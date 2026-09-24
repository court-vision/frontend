import { describe, expect, test } from "bun:test";
import { formatReportAge } from "../injury-report";

describe("formatReportAge", () => {
  test("reads the backend's age in days", () => {
    expect(formatReportAge({ report_date: "2026-09-21", report_age_days: 0 })).toBe("today");
    expect(formatReportAge({ report_date: "2026-09-20", report_age_days: 1 })).toBe("yesterday");
    expect(formatReportAge({ report_date: "2026-09-14", report_age_days: 7 })).toBe("7d ago");
  });

  test("without an age, shows the report's date rather than implying it is current", () => {
    expect(formatReportAge({ report_date: "2026-04-12" })).toBe("Apr 12, 2026");
    expect(formatReportAge({ report_date: "2026-12-01", report_age_days: null })).toBe("Dec 1, 2026");
  });

  test("the fallback keeps the year, so last season is not this season", () => {
    expect(formatReportAge({ report_date: "2025-09-24" })).toBe("Sep 24, 2025");
    expect(formatReportAge({ report_date: "2026-09-24" })).toBe("Sep 24, 2026");
  });

  test("nothing to say without a date or an age", () => {
    expect(formatReportAge({ report_date: null })).toBeNull();
    expect(formatReportAge({ report_date: "not-a-date" })).toBeNull();
  });

  test("a day the month does not have is not a date", () => {
    expect(formatReportAge({ report_date: "2026-02-31" })).toBeNull();
    expect(formatReportAge({ report_date: "2026-02-29" })).toBeNull();
    expect(formatReportAge({ report_date: "2028-02-29" })).toBe("Feb 29, 2028");
    expect(formatReportAge({ report_date: "2026-04-30" })).toBe("Apr 30, 2026");
  });
});
