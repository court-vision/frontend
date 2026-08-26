import { describe, expect, test } from "bun:test";
import { classifyHealth, DEGRADED } from "../health";

describe("classifyHealth", () => {
  test("a healthy body is ok with the database latency", () => {
    const health = classifyHealth({
      status: "ok",
      service: "api",
      version: "a251fdc",
      environment: "production",
      uptime_s: 120,
      checks: { database: { ok: true, latency_ms: 3 } },
    });
    expect(health).toEqual({
      status: "ok",
      dbLatencyMs: 3,
      version: "a251fdc",
      environment: "production",
    });
  });

  test("a degraded body is degraded even without checks", () => {
    expect(classifyHealth({ status: "degraded" }).status).toBe("degraded");
    expect(DEGRADED.status).toBe("degraded");
  });

  test("an ok body whose database check failed is degraded", () => {
    const health = classifyHealth({
      status: "ok",
      checks: { database: { ok: false, error: "timeout" } },
    });
    expect(health.status).toBe("degraded");
    expect(health.dbLatencyMs).toBeNull();
  });

  test("anything off-contract is unknown, never degraded", () => {
    expect(classifyHealth(null).status).toBe("unknown");
    expect(classifyHealth("<html>Not Found</html>").status).toBe("unknown");
    expect(classifyHealth({ detail: "Not Found" }).status).toBe("unknown");
    expect(classifyHealth({ status: 200 }).status).toBe("unknown");
    expect(classifyHealth({ status: "something-else" }).status).toBe("unknown");
  });
});
