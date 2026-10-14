import { describe, expect, test } from "bun:test";
import { prose, spans } from "../ai-prose";
import { SseParser } from "../ai-stream";

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

  test("CRLF line endings work too", () => {
    const p = new SseParser();
    expect(p.push('event: text\r\ndata: {"delta":"a"}\r\n\r\n')).toEqual([{ event: "text", data: { delta: "a" } }]);
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
