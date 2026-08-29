import { describe, expect, test } from "bun:test";
import {
  DEFAULT_RANKINGS_PARAMS,
  normalizeParams,
  paramsKey,
  parseRankingsSearchParams,
  toApiQuery,
  toSearchString,
} from "../rankings-params";

describe("rankings scope", () => {
  test("defaults to global, and anything unrecognised is global", () => {
    expect(DEFAULT_RANKINGS_PARAMS.scope).toBe("global");
    expect(normalizeParams(null).scope).toBe("global");
    expect(normalizeParams({ scope: "nonsense" as never }).scope).toBe("global");
    expect(normalizeParams({ scope: "league" }).scope).toBe("league");
  });

  test("round-trips through the URL, and stays out of it when global", () => {
    expect(toSearchString(normalizeParams({ scope: "global" }))).toBe("");
    expect(toSearchString(normalizeParams({ scope: "league", window: 14 }))).toBe(
      "scope=league&window=14"
    );
    expect(parseRankingsSearchParams("?scope=league").scope).toBe("league");
    expect(parseRankingsSearchParams("?scope=bogus").scope).toBeUndefined();
    expect(parseRankingsSearchParams("?window=7").scope).toBeUndefined();
  });

  test("is not sent to the API — it picks the endpoint, not a query param", () => {
    const league = normalizeParams({ scope: "league", window: 7 });
    expect(toApiQuery(league)).toBe("window=7");
    expect(toApiQuery(league)).not.toContain("scope");
  });

  test("the two scopes never share a query-key identity", () => {
    const global = normalizeParams({ scope: "global", window: 14 });
    const league = normalizeParams({ scope: "league", window: 14 });

    // Identical API query, so without scope in the key these would collide and
    // one scope would be served the other's rankings.
    expect(toApiQuery(global)).toBe(toApiQuery(league));
    expect(paramsKey(global)).not.toBe(paramsKey(league));
  });

  test("params that do differ still key differently within a scope", () => {
    const season = normalizeParams({ scope: "league" });
    const rolling = normalizeParams({ scope: "league", window: 30 });
    expect(paramsKey(season)).not.toBe(paramsKey(rolling));
  });
});
