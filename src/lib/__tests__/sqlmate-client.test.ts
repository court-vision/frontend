import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getSchema, getTables, runVisualQuery } from "../sqlmateClient";
import { SQLMATE_API, SQLMATE_INTERNAL_API } from "@/endpoints";
import type { QueryRequest } from "@/types/sqlmate";

type Call = { url: string; init: RequestInit };
const realFetch = globalThis.fetch;
let calls: Call[] = [];

beforeEach(() => {
  calls = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response("[]", { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("SQLMate API routing", () => {
  test("schema and queries use the public backend proxy without requiring a token", async () => {
    await getSchema(null);
    await runVisualQuery(null, { query_params: [] } as QueryRequest);

    expect(calls.map((call) => call.url)).toEqual([
      `${SQLMATE_API}/schema`,
      `${SQLMATE_API}/query`,
    ]);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  test("saved-table operations use the authenticated internal backend proxy", async () => {
    await getTables("clerk-token");

    expect(calls[0].url).toBe(`${SQLMATE_INTERNAL_API}/users/get_tables`);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(
      "Bearer clerk-token"
    );
  });
});
