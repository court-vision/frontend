import { describe, expect, test } from "bun:test";
import { isReadSentAsPost } from "@/lib/app-map/reads";

const API = "https://api.courtvision.dev";

describe("isReadSentAsPost", () => {
  test("lets the market's search and a lane's dry run through", () => {
    expect(isReadSentAsPost(`${API}/v1/internal/teams/12/streamers/find`, "POST", API)).toBe(true);
    expect(isReadSentAsPost(`${API}/v1/internal/teams/12/stream-lanes/plan`, "post", `${API}/`)).toBe(true);
  });

  test("stops every other write, whatever its route", () => {
    expect(isReadSentAsPost(`${API}/v1/internal/teams/12/stream-lanes`, "POST", API)).toBe(false);
    expect(isReadSentAsPost(`${API}/v1/internal/teams/12/stream-lanes/3`, "PATCH", API)).toBe(false);
    expect(isReadSentAsPost(`${API}/v1/internal/ai/conversations`, "POST", API)).toBe(false);
    expect(isReadSentAsPost(`${API}/v1/internal/streamers/find`, "POST", API)).toBe(false);
    expect(isReadSentAsPost(`${API}/v1/internal/teams/12/streamers/find/x`, "POST", API)).toBe(false);
    expect(isReadSentAsPost(`${API}/v1/internal/teams/x/streamers/find`, "POST", API)).toBe(false);
  });

  test("only to the API", () => {
    expect(isReadSentAsPost("https://www.courtvision.dev/v1/internal/teams/12/streamers/find", "POST", API)).toBe(false);
    expect(isReadSentAsPost("https://api.courtvision.dev.evil.test/v1/internal/teams/12/streamers/find", "POST", API)).toBe(false);
  });
});
