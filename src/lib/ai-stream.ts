/**
 * The AI desk's turn stream: `POST /v1/internal/ai/conversations/{id}/turns`
 * answers with server-sent events (backend api/v1/internal/ai.py):
 *
 * - `status` `{text, kind, tool?}`: what the agent is doing (`tool` for a
 *   lookup, `note` for its own progress note);
 * - `text` `{delta}`: the answer's prose, as it is written;
 * - `block`: a table the server built from the agent's lookups;
 * - `error` `{code, message}`: the turn failed;
 * - `done` `{turn_id, outcome, cost_usd, …}`: always last.
 *
 * Lines starting with `:` are keepalives. An error before the stream starts
 * (invite-only, busy, budget spent) is an ordinary JSON error response, thrown
 * as an `ApiError` like any other request's.
 *
 * Not `fetchJson`: it reads the whole body and times out at 15 s, while a turn
 * streams for as long as the agent works (the server bounds it at 150 s).
 */
import { ApiError } from "./api-error";
import { CORRELATION_HEADER, type GetTokenFn } from "./http";
import type { AiTable } from "@/types/ai";

export type AiStreamEvent =
  | { event: "status"; data: { text: string; kind: "tool" | "note"; tool?: string } }
  | { event: "text"; data: { delta: string } }
  | { event: "block"; data: AiTable }
  | { event: "error"; data: { code: string; message: string } }
  | { event: "done"; data: AiTurnDone };

export interface AiTurnDone {
  turn_id: number | null;
  outcome: string;
  cost_usd: number;
  model_calls: number;
  duration_ms: number;
  spend: { month_usd: number; cap_usd: number } | null;
}

const KNOWN = new Set(["status", "text", "block", "error", "done"]);

/**
 * Splits SSE text into events. Feed it chunks as they arrive; it returns the
 * events completed so far and keeps any partial one for the next chunk.
 * Unknown event names and unparseable data are dropped, never thrown.
 */
export class SseParser {
  private buffer = "";

  push(chunk: string): AiStreamEvent[] {
    this.buffer += chunk.replace(/\r\n/g, "\n");
    const out: AiStreamEvent[] = [];
    let end = this.buffer.indexOf("\n\n");
    while (end !== -1) {
      const raw = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 2);
      const event = parseEvent(raw);
      if (event) out.push(event);
      end = this.buffer.indexOf("\n\n");
    }
    return out;
  }
}

function parseEvent(raw: string): AiStreamEvent | null {
  let name = "message";
  const data: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") name = value;
    else if (field === "data") data.push(value);
  }
  if (!KNOWN.has(name) || data.length === 0) return null;
  try {
    return { event: name, data: JSON.parse(data.join("\n")) } as AiStreamEvent;
  } catch {
    return null;
  }
}

/**
 * Send one message and call `onEvent` for each event as it arrives. Resolves
 * when the stream ends. Throws `ApiError` for a refusal before the stream (or
 * a dropped connection); a failure during the turn arrives as an `error` event.
 */
export async function streamTurn(
  getToken: GetTokenFn,
  url: string,
  message: string,
  onEvent: (event: AiStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const token = await getToken();
  if (!token) throw ApiError.auth();
  const correlationId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : undefined;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(correlationId ? { [CORRELATION_HEADER]: correlationId } : {}),
      },
      body: JSON.stringify({ message }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw ApiError.network(err);
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // not JSON: keep the text
    }
    throw ApiError.fromResponse(res, parsed, res.headers.get(CORRELATION_HEADER) ?? correlationId);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const parser = new SseParser();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const event of parser.push(value)) onEvent(event);
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    throw ApiError.network(err);
  } finally {
    reader.releaseLock();
  }
}
