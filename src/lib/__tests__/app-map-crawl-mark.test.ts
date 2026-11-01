import { describe, expect, test } from "bun:test";
import { CRAWL_HEADER, markedForApi } from "@/lib/app-map/crawl-mark";

const API = "https://api.courtvision.dev";

describe("markedForApi", () => {
  test("marks a request to the API and keeps its headers", () => {
    expect(markedForApi(`${API}/v1/internal/teams/12/lineup`, { authorization: "Bearer t" }, API)).toEqual({
      authorization: "Bearer t",
      [CRAWL_HEADER]: "1",
    });
    expect(markedForApi(`${API}/v1/internal/teams/12/streamers/find`, {}, `${API}/`)).toEqual({ [CRAWL_HEADER]: "1" });
  });

  test("leaves every other host as it is", () => {
    expect(markedForApi("https://www.courtvision.dev/week", {}, API)).toBeUndefined();
    expect(markedForApi("https://clerk.courtvision.dev/v1/client", {}, API)).toBeUndefined();
    expect(markedForApi("https://api.courtvision.dev.evil.test/v1/internal/teams", {}, API)).toBeUndefined();
  });
});
