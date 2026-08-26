import { describe, expect, test } from "bun:test";
import {
  ApiError,
  isEmptyResult,
  isProviderAuthError,
  toApiError,
  userMessage,
  type ApiErrorKind,
} from "../api-error";
import type { ApiStatus } from "../../types/auth";

function response(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers,
  });
}

describe("ApiError.fromResponse", () => {
  const cases: Array<[number, string | null, ApiErrorKind, boolean]> = [
    [400, "BAD_REQUEST", "validation", false],
    [401, "AUTH_REQUIRED", "auth", false],
    [403, "FORBIDDEN", "forbidden", false],
    [403, "PROVIDER_AUTH_EXPIRED", "forbidden", false],
    [404, "TEAM_NOT_FOUND", "not_found", false],
    [422, "VALIDATION_ERROR", "validation", false],
    [429, "RATE_LIMITED", "rate_limited", true],
    [500, "INTERNAL_ERROR", "server", false],
    [502, "PROVIDER_UNAVAILABLE", "provider", true],
    [503, "DATABASE_UNAVAILABLE", "server", true],
    [503, "LINEUP_SERVICE_UNAVAILABLE", "server", true],
    [504, "PROVIDER_TIMEOUT", "provider", true],
  ];
  for (const [status, code, kind, retryable] of cases) {
    test(`${status} ${code} → ${kind}${retryable ? " (retryable)" : ""}`, () => {
      const err = ApiError.fromResponse(
        response({ status: "error", message: "boom", error_code: code }, status),
        { status: "error", message: "boom", error_code: code }
      );
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(status);
      expect(err.kind).toBe(kind);
      expect(err.code).toBe(code);
      expect(err.retryable).toBe(retryable);
      expect(err.message).toBe("boom");
    });
  }

  test("reads FastAPI's {detail} for a plain HTTPException", () => {
    const body = { detail: "Token has expired" };
    const err = ApiError.fromResponse(response(body, 401), body);
    expect(err.kind).toBe("auth");
    expect(err.message).toBe("Token has expired");
    expect(err.apiStatus).toBeNull();
  });

  test("keeps 422 field errors in data", () => {
    const body = {
      status: "validation_error",
      message: "Validation failed",
      error_code: "VALIDATION_ERROR",
      data: { errors: [{ loc: ["query", "window"], msg: "bad" }] },
    };
    const err = ApiError.fromResponse(response(body, 422), body);
    expect(err.kind).toBe("validation");
    expect(err.apiStatus).toBe("validation_error");
    expect(err.data).toEqual(body.data);
  });

  test("non-JSON body → generic message, never the raw text", () => {
    const err = ApiError.fromResponse(response("Internal Server Error", 500), "Internal Server Error");
    expect(err.kind).toBe("server");
    expect(err.message).toBe("Request failed (HTTP 500)");
  });

  test("correlation id: body wins over header, header over the request id", () => {
    const withBody = {
      status: "server_error",
      message: "x",
      data: { correlation_id: "from-body" },
    };
    expect(
      ApiError.fromResponse(
        response(withBody, 500, { "X-Correlation-ID": "from-header" }),
        withBody,
        "from-request"
      ).correlationId
    ).toBe("from-body");
    expect(
      ApiError.fromResponse(
        response({ status: "server_error", message: "x" }, 500, {
          "X-Correlation-ID": "from-header",
        }),
        { status: "server_error", message: "x" },
        "from-request"
      ).correlationId
    ).toBe("from-header");
    expect(ApiError.fromResponse(response(null, 500), null, "from-request").correlationId).toBe(
      "from-request"
    );
  });
});

describe("ApiError.fromEnvelope (200 with an error status)", () => {
  const cases: Array<[ApiStatus, string | null, number, ApiErrorKind, boolean]> = [
    ["not_found", null, 404, "not_found", false],
    ["authentication_error", null, 401, "auth", false],
    ["authorization_error", null, 403, "forbidden", false],
    ["bad_request", null, 400, "validation", false],
    ["validation_error", null, 422, "validation", false],
    ["rate_limited", null, 429, "rate_limited", true],
    ["error", "LINEUP_SERVICE_UNAVAILABLE", 503, "server", true],
    ["error", "PROVIDER_UNAVAILABLE", 502, "provider", true],
    ["error", "PROVIDER_AUTH_EXPIRED", 403, "forbidden", false],
    ["error", null, 500, "server", false],
    ["server_error", null, 500, "server", false],
  ];
  for (const [apiStatus, code, status, kind, retryable] of cases) {
    test(`${apiStatus}${code ? ` + ${code}` : ""} → ${status} ${kind}`, () => {
      const err = ApiError.fromEnvelope({ status: apiStatus, message: "m", error_code: code });
      expect(err.status).toBe(status);
      expect(err.kind).toBe(kind);
      expect(err.apiStatus).toBe(apiStatus);
      expect(err.retryable).toBe(retryable);
      expect(err.message).toBe("m");
    });
  }

  test("carries data.correlation_id", () => {
    const err = ApiError.fromEnvelope({
      status: "error",
      message: "m",
      data: { correlation_id: "abc" },
    });
    expect(err.correlationId).toBe("abc");
  });
});

describe("constructors", () => {
  test("network / timeout are retryable with status 0", () => {
    const net = ApiError.network(new TypeError("Failed to fetch"));
    expect(net.kind).toBe("network");
    expect(net.status).toBe(0);
    expect(net.retryable).toBe(true);
    const t = ApiError.timeout(15000);
    expect(t.kind).toBe("timeout");
    expect(t.retryable).toBe(true);
  });

  test("auth is a 401 that is not retryable", () => {
    const err = ApiError.auth();
    expect(err.status).toBe(401);
    expect(err.kind).toBe("auth");
    expect(err.code).toBe("AUTH_REQUIRED");
    expect(err.retryable).toBe(false);
  });

  test("empty keeps the backend message and is recognisable", () => {
    const err = ApiError.empty({ message: "No active matchup" });
    expect(isEmptyResult(err)).toBe(true);
    expect(err.message).toBe("No active matchup");
    expect(err.retryable).toBe(false);
  });
});

describe("toApiError", () => {
  test("passes ApiError through", () => {
    const err = ApiError.auth();
    expect(toApiError(err)).toBe(err);
  });
  test("AbortError → timeout", () => {
    expect(toApiError(new DOMException("aborted", "AbortError")).kind).toBe("timeout");
  });
  test("fetch TypeError → network", () => {
    expect(toApiError(new TypeError("Failed to fetch")).kind).toBe("network");
    expect(toApiError(new TypeError("Load failed")).kind).toBe("network");
  });
  test("anything else → unknown", () => {
    expect(toApiError(new Error("bug")).kind).toBe("unknown");
    expect(toApiError("bug").message).toBe("bug");
    expect(toApiError(undefined).kind).toBe("unknown");
  });
});

describe("userMessage", () => {
  test("network", () => {
    expect(userMessage(ApiError.network(new TypeError("Failed to fetch")))).toBe(
      "Can't reach the Court Vision API — check your connection and retry"
    );
  });
  test("auth", () => {
    expect(userMessage(ApiError.auth())).toBe("Your session expired — sign in again");
  });
  test("provider auth expired names the provider", () => {
    const err = ApiError.fromEnvelope({
      status: "authorization_error",
      message: "x",
      error_code: "PROVIDER_AUTH_EXPIRED",
      data: { provider: "yahoo" },
    });
    expect(isProviderAuthError(err)).toBe(true);
    expect(userMessage(err)).toBe(
      "Your Yahoo connection expired — reconnect it in Manage Teams"
    );
  });
  test("provider unavailable", () => {
    const body = {
      status: "server_error",
      message: "x",
      error_code: "PROVIDER_UNAVAILABLE",
      data: { provider: "espn" },
    };
    expect(userMessage(ApiError.fromResponse(response(body, 502), body))).toBe(
      "ESPN isn't responding — retry in a minute"
    );
  });
  test("server: envelope message, else generic with the correlation ref", () => {
    const body = { status: "server_error", message: "Database unavailable" };
    expect(userMessage(ApiError.fromResponse(response(body, 503), body))).toBe(
      "Database unavailable"
    );
    expect(
      userMessage(
        ApiError.fromResponse(
          response("Internal Server Error", 500, { "X-Correlation-ID": "0123456789abcdef" }),
          "Internal Server Error"
        )
      )
    ).toBe("Something went wrong on our side (ref 01234567)");
  });
  test("validation / not_found use the backend message", () => {
    const body = { status: "not_found", message: "Team with ID 3 not found" };
    expect(userMessage(ApiError.fromResponse(response(body, 404), body))).toBe(
      "Team with ID 3 not found"
    );
    expect(userMessage(new Error(""), "fallback")).toBe("fallback");
  });
});
