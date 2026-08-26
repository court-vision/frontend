import { describe, expect, test } from "bun:test";
import { formatRelativeTime } from "../relative-time";

const NOW = 1_700_000_000_000;

describe("formatRelativeTime", () => {
  test("never for an unset timestamp", () => {
    expect(formatRelativeTime(0, NOW)).toBe("never");
  });

  test("buckets seconds, minutes, hours and days", () => {
    expect(formatRelativeTime(NOW - 2_000, NOW)).toBe("just now");
    expect(formatRelativeTime(NOW - 12_000, NOW)).toBe("12 s ago");
    expect(formatRelativeTime(NOW - 3 * 60_000, NOW)).toBe("3 min ago");
    expect(formatRelativeTime(NOW - 2 * 3_600_000, NOW)).toBe("2 h ago");
    expect(formatRelativeTime(NOW - 4 * 86_400_000, NOW)).toBe("4 d ago");
  });

  test("a timestamp in the future reads as just now", () => {
    expect(formatRelativeTime(NOW + 60_000, NOW)).toBe("just now");
  });
});
