import { describe, expect, test } from "bun:test";

import { MAX_RAW_ERROR_LENGTH, yahooConnectErrorMessage } from "../yahoo-connect";

describe("yahooConnectErrorMessage", () => {
  test("a Fantasy refusal after a good login points at the developer console", () => {
    const message = yahooConnectErrorMessage("fantasy_not_authorized");
    expect(message).toContain("Fantasy Sports API refused");
    expect(message).toContain("developer console");
  });

  test("known codes read as sentences, not codes", () => {
    for (const code of ["no_account_id", "oauth_failed", "invalid_state", "oauth_storage_unavailable"]) {
      expect(yahooConnectErrorMessage(code)).not.toContain(code);
    }
  });

  test("an unknown code is shown as-is and truncated", () => {
    const long = "x".repeat(500);
    const message = yahooConnectErrorMessage(long);
    expect(message).toBe(`Yahoo connection failed: ${"x".repeat(MAX_RAW_ERROR_LENGTH)}`);
  });
});
