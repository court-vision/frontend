import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ApiError } from "../api-error";
import { fetchJson, nullOn404, sendsCorrelationId, unwrap, unwrapWithMessage } from "../http";

type Call = { url: string; init: RequestInit };
const realFetch = globalThis.fetch;
let calls: Call[] = [];

function stubFetch(impl: (url: string, init: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return impl(call.url, call.init);
  }) as typeof fetch;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function headerOf(call: Call, name: string): string | undefined {
  return (call.init.headers as Record<string, string>)[name];
}

/** The rejection of `request`, asserted to be an ApiError. */
async function failure(request: Promise<unknown>): Promise<ApiError> {
  try {
    await request;
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    return e as ApiError;
  }
  throw new Error("expected the request to reject");
}

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("fetchJson", () => {
  test("sends a correlation id, bearer token and JSON body", async () => {
    stubFetch(() => json({ status: "success", message: "ok", data: { id: 1 } }));
    const result = await fetchJson<{ data: { id: number } }>("http://api/x", {
      getToken: async () => "tok",
      method: "POST",
      body: { a: 1 },
    });
    expect(result.data.id).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.body).toBe('{"a":1}');
    expect(headerOf(calls[0], "Authorization")).toBe("Bearer tok");
    expect(headerOf(calls[0], "Content-Type")).toBe("application/json");
    expect(headerOf(calls[0], "X-Correlation-ID")).toMatch(/^[0-9a-f-]{8,}$/);
  });

  test("GET without a body sends no Content-Type", async () => {
    stubFetch(() => json({ status: "success", message: "ok", data: [] }));
    await fetchJson("http://api/x");
    expect(headerOf(calls[0], "Content-Type")).toBeUndefined();
    expect(headerOf(calls[0], "Authorization")).toBeUndefined();
  });

  test("a public GET sends only CORS-safelisted headers, so the browser skips the preflight", async () => {
    stubFetch(() => json({ status: "success", message: "ok", data: [] }));
    await fetchJson("http://api/v1/players/203999/percentiles");
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.headers).toEqual({ Accept: "application/json" });
    // Fetch's CORS-safelisted request headers; Content-Type only with form or
    // text values, which the client never sends. Anything else (our own
    // X-Correlation-ID, Authorization, a JSON Content-Type) forces an OPTIONS.
    const safelisted = new Set(["accept", "accept-language", "content-language"]);
    for (const name of Object.keys(calls[0].init.headers as Record<string, string>)) {
      expect(safelisted.has(name.toLowerCase())).toBe(true);
    }
  });

  test("an authenticated GET still sends a correlation id (Authorization preflights it anyway)", async () => {
    stubFetch(() => json({ status: "success", message: "ok", data: [] }));
    await fetchJson("http://api/v1/internal/teams/", { getToken: async () => "tok" });
    expect(headerOf(calls[0], "Authorization")).toBe("Bearer tok");
    expect(headerOf(calls[0], "X-Correlation-ID")).toMatch(/^[0-9a-f-]{8,}$/);
  });

  test("a write sends a correlation id even without a token", async () => {
    stubFetch(() => json({ status: "success", message: "ok", data: null }));
    await fetchJson("http://api/x", { method: "POST", body: { a: 1 } });
    await fetchJson("http://api/x", { method: "DELETE" });
    for (const call of calls) {
      expect(headerOf(call, "X-Correlation-ID")).toMatch(/^[0-9a-f-]{8,}$/);
    }
  });

  test("sendsCorrelationId: only requests the browser preflights anyway", () => {
    expect(sendsCorrelationId("GET", false)).toBe(false);
    expect(sendsCorrelationId("GET", true)).toBe(true);
    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      expect(sendsCorrelationId(method, false)).toBe(true);
      expect(sendsCorrelationId(method, true)).toBe(true);
    }
  });

  test("a public GET's error carries the correlation id the API minted", async () => {
    // A 500 whose body has no correlation_id: the exposed response header is the only source.
    stubFetch(() => json({ detail: "boom" }, 500, { "X-Correlation-ID": "minted-by-api" }));
    const err = await failure(fetchJson("http://api/x"));
    expect(headerOf(calls[0], "X-Correlation-ID")).toBeUndefined();
    expect(err.status).toBe(500);
    expect(err.correlationId).toBe("minted-by-api");
  });

  test("a public GET's 200-with-error envelope reads the id from the response header too", async () => {
    stubFetch(() =>
      json({ status: "not_found", message: "no", data: null }, 200, {
        "X-Correlation-ID": "minted-by-api",
      })
    );
    const err = await failure(fetchJson("http://api/x"));
    expect(err.status).toBe(404);
    expect(err.correlationId).toBe("minted-by-api");
  });

  test("the error keeps the id we sent when the response carries none", async () => {
    stubFetch(() => json({ detail: "boom" }, 500));
    const err = await failure(fetchJson("http://api/x", { getToken: async () => "tok" }));
    const sent = headerOf(calls[0], "X-Correlation-ID");
    expect(sent).toBeDefined();
    expect(err.correlationId).toBe(sent!);
  });

  test("a public GET's error has no correlation id when the API sent none", async () => {
    stubFetch(() => json({ detail: "boom" }, 500));
    expect((await failure(fetchJson("http://api/x"))).correlationId).toBeNull();
  });

  test("null token → ApiError.auth() and no request is made", async () => {
    stubFetch(() => json({}));
    const err = await failure(fetchJson("http://api/x", { getToken: async () => null }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe("auth");
    expect(err.retryable).toBe(false);
    expect(calls).toHaveLength(0);
  });

  test("401 → auth kind, not retryable, one request", async () => {
    stubFetch(() => json({ detail: "Token has expired" }, 401));
    const err = await failure(fetchJson("http://api/x", { getToken: async () => "tok" }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.kind).toBe("auth");
    expect(err.retryable).toBe(false);
    expect(err.message).toBe("Token has expired");
    expect(calls).toHaveLength(1);
  });

  test("timeout → the abort becomes a timeout ApiError", async () => {
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError"))
          );
        })
    );
    const err = await failure(fetchJson("http://api/slow", { timeoutMs: 5 }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe("timeout");
    expect(err.retryable).toBe(true);
  });

  test("caller's abort signal propagates untouched (TanStack cancellation)", async () => {
    const outer = new AbortController();
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError"))
          );
        })
    );
    const pending = fetchJson("http://api/x", { signal: outer.signal }).catch((e: unknown) => e);
    outer.abort();
    const err = await pending;
    expect(err).not.toBeInstanceOf(ApiError);
    expect((err as Error).name).toBe("AbortError");
  });

  test("network failure → network ApiError", async () => {
    stubFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    const err = await failure(fetchJson("http://api/x"));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe("network");
    expect(err.retryable).toBe(true);
  });

  test("200 with status not_found → 404 ApiError", async () => {
    stubFetch(() => json({ status: "not_found", message: "Team with ID 3 not found", data: null }));
    const err = await failure(fetchJson("http://api/x"));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.kind).toBe("not_found");
    expect(err.message).toBe("Team with ID 3 not found");
  });

  test("429 and 503 are retryable; 422 keeps its field errors", async () => {
    stubFetch(() => json({ status: "rate_limited", message: "slow down" }, 429));
    expect((await failure(fetchJson("http://api/x"))).retryable).toBe(true);
    stubFetch(() =>
      json({ status: "server_error", message: "db", error_code: "DATABASE_UNAVAILABLE" }, 503)
    );
    expect((await failure(fetchJson("http://api/x"))).retryable).toBe(true);
    stubFetch(() =>
      json(
        {
          status: "validation_error",
          message: "Validation failed",
          error_code: "VALIDATION_ERROR",
          data: { errors: [{ loc: ["query", "window"] }] },
        },
        422
      )
    );
    const err = await failure(fetchJson("http://api/x"));
    expect(err.kind).toBe("validation");
    expect(err.data).toEqual({ errors: [{ loc: ["query", "window"] }] });
  });

  test("raw passes an error envelope through untouched", async () => {
    const body = { status: "error", message: "provider unreachable", data: { format: "points" } };
    stubFetch(() => json(body));
    const result = await fetchJson<typeof body>("http://api/x", { raw: true });
    expect(result).toEqual(body);
  });

  test("raw still throws on a non-2xx status", async () => {
    stubFetch(() => json({ status: "not_found", message: "gone" }, 404));
    const err = await failure(fetchJson("http://api/x", { raw: true }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
  });

  test("non-envelope JSON passes through", async () => {
    stubFetch(() => json({ ok: true }));
    expect(await fetchJson<{ ok: boolean }>("http://api/health")).toEqual({ ok: true });
  });
});

describe("unwrap helpers", () => {
  test("unwrap returns data, the fallback for an empty state, or throws EMPTY_RESULT", () => {
    expect(unwrap({ status: "success", data: [1] })).toEqual([1]);
    expect(unwrap({ status: "success", message: "none", data: null }, [])).toEqual([]);
    expect(unwrap<{ id: number }, null>({ status: "success", data: null }, null)).toBeNull();
    let thrown: unknown;
    try {
      unwrap({ status: "success", message: "No active matchup", data: null });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).code).toBe("EMPTY_RESULT");
    expect((thrown as ApiError).message).toBe("No active matchup");
  });

  test("unwrapWithMessage keeps the backend message for empty states", () => {
    expect(
      unwrapWithMessage({ status: "success", message: "No 2026-27 data yet", data: null }, [])
    ).toEqual({ data: [], message: "No 2026-27 data yet" });
  });

  test("nullOn404 swallows only 404s", async () => {
    stubFetch(() => json({ status: "not_found", message: "no" }, 404));
    expect(await nullOn404(fetchJson("http://api/x"))).toBeNull();
    stubFetch(() => json({ status: "not_found", message: "no" }));
    expect(await nullOn404(fetchJson("http://api/x"))).toBeNull();
    stubFetch(() => json({ status: "server_error", message: "boom" }, 500));
    const err = await failure(nullOn404(fetchJson("http://api/x")));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
  });
});
