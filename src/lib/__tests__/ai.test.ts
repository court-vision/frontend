import { afterEach, describe, expect, test } from "bun:test";
import { prose, spans } from "../ai-prose";
import { SseParser, streamTurn, type AiStreamEvent } from "../ai-stream";

describe("SseParser", () => {
  test("reads events split across chunks, in order", () => {
    const p = new SseParser();
    expect(p.push('event: status\ndata: {"text":"Reading your matchup","kind":"tool"}\n\nevent: te')).toEqual([
      { event: "status", data: { text: "Reading your matchup", kind: "tool" } },
    ]);
    expect(p.push('xt\ndata: {"delta":"You trail"}\n')).toEqual([]);
    expect(p.push('\nevent: text\ndata: {"delta":" in blocks."}\n\n')).toEqual([
      { event: "text", data: { delta: "You trail" } },
      { event: "text", data: { delta: " in blocks." } },
    ]);
  });

  test("skips keepalives, unknown events and unparseable data", () => {
    const p = new SseParser();
    const out = p.push(': keepalive\n\nevent: mystery\ndata: {}\n\nevent: text\ndata: {oops\n\nevent: done\ndata: {"turn_id":4}\n\n');
    expect(out).toEqual([{ event: "done", data: { turn_id: 4 } } as never]);
  });

  test("CRLF line endings work too, even split between chunks", () => {
    const p = new SseParser();
    expect(p.push('event: text\r\ndata: {"delta":"a"}\r\n\r\n')).toEqual([{ event: "text", data: { delta: "a" } }]);
    expect(p.push('event: text\r\ndata: {"delta":"b"}\r')).toEqual([]);
    expect(p.push("\n\r\n")).toEqual([{ event: "text", data: { delta: "b" } }]);
  });
});

describe("streamTurn", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function serve(...chunks: string[]) {
    globalThis.fetch = (async () =>
      new Response(
        new ReadableStream({
          start(c) {
            for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk));
            c.close();
          },
        }),
        { status: 200, headers: { "Content-Type": "text/event-stream" } }
      )) as unknown as typeof fetch;
  }

  test("delivers events in order and resolves on done", async () => {
    serve('event: text\ndata: {"delta":"Hi"}\n\n', 'event: done\ndata: {"turn_id":3,"outcome":"ok"}\n\n');
    const seen: AiStreamEvent[] = [];
    await streamTurn(async () => "tok", "https://api/x", "hello", (e) => seen.push(e));
    expect(seen.map((e) => e.event)).toEqual(["text", "done"]);
  });

  test("a stream that ends without done is an error, not a finished turn", async () => {
    serve('event: text\ndata: {"delta":"Hi"}\n\n');
    await expect(streamTurn(async () => "tok", "https://api/x", "hello", () => {})).rejects.toThrow();
  });

  test("a refusal before the stream is an ApiError with the server's code", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ status: "error", message: "busy", error_code: "AI_CONVERSATION_BUSY" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof fetch;
    await expect(streamTurn(async () => "tok", "https://api/x", "hello", () => {})).rejects.toMatchObject({
      status: 409,
      code: "AI_CONVERSATION_BUSY",
    });
  });
});

describe("prose", () => {
  test("bold spans; an unclosed ** stays as written", () => {
    expect(spans("Add **Edgecombe** now")).toEqual([
      { text: "Add ", bold: false },
      { text: "Edgecombe", bold: true },
      { text: " now", bold: false },
    ]);
    expect(spans("2 ** 3")).toEqual([{ text: "2 ** 3", bold: false }]);
  });

  test("paragraphs and bullet lists", () => {
    expect(prose("First line\nsame paragraph.\n\n- **A** one\n- B two\nAfter.")).toEqual([
      { kind: "p", spans: [{ text: "First line same paragraph.", bold: false }] },
      {
        kind: "ul",
        items: [
          [
            { text: "A", bold: true },
            { text: " one", bold: false },
          ],
          [{ text: "B two", bold: false }],
        ],
      },
      { kind: "p", spans: [{ text: "After.", bold: false }] },
    ]);
  });

  test("markup in the text is only text", () => {
    expect(prose("<img src=x onerror=alert(1)>")).toEqual([
      { kind: "p", spans: [{ text: "<img src=x onerror=alert(1)>", bold: false }] },
    ]);
  });
});

describe("drafts", () => {
  const hadWindow = "window" in globalThis;
  const realWindow = (globalThis as { window?: unknown }).window;
  afterEach(() => {
    if (hadWindow) (globalThis as { window?: unknown }).window = realWindow;
    else delete (globalThis as { window?: unknown }).window;
  });

  function fakeStorage(fail = false) {
    const store = new Map<string, string>();
    const storage = {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => {
        if (fail) throw new Error("blocked");
        return store.get(k) ?? null;
      },
      setItem: (k: string, v: string) => {
        if (fail) throw new Error("blocked");
        store.set(k, v);
      },
      removeItem: (k: string) => void store.delete(k),
    };
    (globalThis as unknown as { window: unknown }).window = { localStorage: storage };
    return store;
  }

  test("one per conversation and user; blank removes it", async () => {
    const { draftKey, loadDraft, saveDraft } = await import("../ai-drafts");
    fakeStorage();
    expect(draftKey(null, 3)).toBeNull();
    const a = draftKey("user_1", 3);
    const fresh = draftKey("user_1", null);
    expect(fresh).toBe("cv.ai.draft.user_1.new");
    saveDraft(a, "who should I drop");
    saveDraft(fresh, "new one");
    expect(loadDraft(a)).toBe("who should I drop");
    expect(loadDraft(fresh)).toBe("new one");
    expect(loadDraft(draftKey("user_2", 3))).toBe("");
    saveDraft(a, "   ");
    expect(loadDraft(a)).toBe("");
  });

  test("keeps only the newest drafts", async () => {
    const { draftKey, saveDraft } = await import("../ai-drafts");
    const store = fakeStorage();
    for (let i = 1; i <= 45; i++) saveDraft(draftKey("u", i), `draft ${i}`);
    expect(store.size).toBe(40);
  });

  test("blocked storage loses the draft, never the page", async () => {
    const { draftKey, loadDraft, saveDraft } = await import("../ai-drafts");
    fakeStorage(true);
    expect(() => saveDraft(draftKey("u", 1), "x")).not.toThrow();
    expect(loadDraft(draftKey("u", 1))).toBe("");
  });
});
