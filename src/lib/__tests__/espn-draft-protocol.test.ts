import { describe, expect, test } from "bun:test";
import {
  espnLeagueIdFromUrl,
  parseExtensionMessage,
  parseFrame,
  peekInitHeader,
  type DraftFrame,
} from "../espn-draft/protocol";

// The first ~24 base64 chars of a room-open INIT payload: league 35392660, team 5.
const INIT_ROOMOPEN_PREFIX = "AAAAAQAAAAECHAyUAAAABQ";

describe("parseFrame", () => {
  test("SELECTED with no selector is an autopick", () => {
    const f = parseFrame("SELECTED 8 3908809 2");
    expect(f).toEqual({ op: "SELECTED", teamId: 8, playerId: 3908809, slotId: 2, selector: null });
  });

  test("SELECTED with a SWID is a human pick", () => {
    const f = parseFrame("SELECTED 3 4431671 12 {BC1331CC-B20C-45FD-80F9-D5A0572D04EF}");
    expect(f).toEqual({
      op: "SELECTED",
      teamId: 3,
      playerId: 4431671,
      slotId: 12,
      selector: "{BC1331CC-B20C-45FD-80F9-D5A0572D04EF}",
    });
  });

  test("SOLD reads four of its five args", () => {
    expect(parseFrame("SOLD 8 4278073 1 68 0")).toEqual({
      op: "SOLD",
      teamId: 8,
      playerId: 4278073,
      slotId: 1,
      bid: 68,
    });
  });

  test("UNDONE, RESET, SELECTING", () => {
    expect(parseFrame("UNDONE 12")).toEqual({ op: "UNDONE", pickNumber: 12 });
    expect(parseFrame("RESET")).toEqual({ op: "RESET" });
    expect(parseFrame("SELECTING 8 30000")).toEqual({ op: "SELECTING", teamId: 8, msRemaining: 30000 });
  });

  test("CLOCK is variable arity", () => {
    expect(parseFrame("CLOCK 6 25747 2")).toEqual({
      op: "CLOCK",
      phase: 6,
      time: 25747,
      teamId: 2,
      playerId: null,
      amount: null,
    });
    expect(parseFrame("CLOCK 4")).toEqual({ op: "CLOCK", phase: 4, time: null, teamId: null, playerId: null, amount: null });
  });

  test("AUTODRAFT parses its boolean", () => {
    expect(parseFrame("AUTODRAFT 3 false")).toEqual({ op: "AUTODRAFT", teamId: 3, enabled: false });
    expect(parseFrame("AUTODRAFT 3 true")).toEqual({ op: "AUTODRAFT", teamId: 3, enabled: true });
    expect((parseFrame("AUTODRAFT 3 maybe") as DraftFrame).op).toBe("malformed");
  });

  test("INIT keeps its payload", () => {
    const f = parseFrame(`INIT ${INIT_ROOMOPEN_PREFIX}`);
    expect(f).toEqual({ op: "INIT", payload: INIT_ROOMOPEN_PREFIX });
  });

  test("unknown opcodes are ignored, not errors", () => {
    expect(parseFrame('PROJECTED_STANDINGS {"projectedTeams":[]}')).toEqual({ op: "ignored", opcode: "PROJECTED_STANDINGS" });
    expect(parseFrame("PONG PING%201788471639467")).toEqual({ op: "ignored", opcode: "PONG" });
  });

  test("a SELECTED missing a numeric arg is malformed, never throws", () => {
    expect(parseFrame("SELECTED 8 notanumber")).toEqual({ op: "malformed", opcode: "SELECTED", raw: "SELECTED 8 notanumber" });
    expect(parseFrame("")).toEqual({ op: "ignored", opcode: "(empty)" });
  });
});

describe("espnLeagueIdFromUrl", () => {
  test("both the JOIN and sse forms", () => {
    expect(espnLeagueIdFromUrl("wss://fantasydraft.espn.com/game-3/league-35392660/JOIN")).toBe(35392660);
    expect(espnLeagueIdFromUrl("https://fantasydraft.espn.com/game-3/league-588175580/sse/JOIN")).toBe(588175580);
    expect(espnLeagueIdFromUrl(undefined)).toBeNull();
    expect(espnLeagueIdFromUrl("wss://fantasydraft.espn.com/game-3/nope")).toBeNull();
  });
});

describe("peekInitHeader", () => {
  test("reads leagueId and teamId from the real payload prefix", () => {
    expect(peekInitHeader(INIT_ROOMOPEN_PREFIX)).toEqual({ leagueId: 35392660, teamId: 5 });
  });

  test("rejects a too-short or non-base64 payload", () => {
    expect(peekInitHeader("AAAA")).toBeNull();
    expect(peekInitHeader("!!!!not base64!!!!")).toBeNull();
  });
});

describe("parseExtensionMessage", () => {
  test("accepts a record with unknown extra fields (loose)", () => {
    const msg = parseExtensionMessage({
      type: "record",
      record: { ts: 1, kind: "frame", dir: "in", frame: "RESET", somethingNew: 42 },
    });
    expect(msg?.type).toBe("record");
  });

  test("accepts hello and replay", () => {
    expect(parseExtensionMessage({ type: "hello", version: "0.2.0" })?.type).toBe("hello");
    expect(parseExtensionMessage({ type: "replay", records: [{ ts: 1, kind: "open" }] })?.type).toBe("replay");
  });

  test("rejects a record missing ts, and a replay with a bad record", () => {
    expect(parseExtensionMessage({ type: "record", record: { kind: "frame" } })).toBeNull();
    expect(parseExtensionMessage({ type: "replay", records: [{ kind: "frame" }] })).toBeNull();
    expect(parseExtensionMessage({ type: "nonsense" })).toBeNull();
    expect(parseExtensionMessage(null)).toBeNull();
  });
});

describe("ERROR frames and the write-path messages", () => {
  test("ERROR decodes + and percent escapes", () => {
    expect(parseFrame("ERROR 1 Not+your+turn%21")).toEqual({
      op: "ERROR",
      severity: 1,
      text: "Not your turn!",
      raw: "ERROR 1 Not+your+turn%21",
    });
  });

  test("a bare ERROR is still an ERROR, and a bad escape keeps the raw text", () => {
    expect(parseFrame("ERROR")).toEqual({ op: "ERROR", severity: null, text: "", raw: "ERROR" });
    expect(parseFrame("ERROR 2 100%+sure")).toMatchObject({ op: "ERROR", severity: 2, text: "100% sure" });
  });

  test("hello with and without capabilities; the capabilities message", () => {
    expect(parseExtensionMessage({ type: "hello", version: "0.2.0" })).toEqual({ type: "hello", version: "0.2.0" });
    expect(parseExtensionMessage({ type: "hello", version: "0.3.0", capabilities: ["read", "write"] })).toEqual({
      type: "hello",
      version: "0.3.0",
      capabilities: ["read", "write"],
    });
    expect(parseExtensionMessage({ type: "capabilities", capabilities: ["read"] })).toEqual({
      type: "capabilities",
      capabilities: ["read"],
    });
  });

  test("a command-result record parses with its fields", () => {
    const m = parseExtensionMessage({
      type: "record",
      record: { ts: 1, kind: "command-result", cmd: "select", requestId: "r", playerId: 5, ok: false, reason: "sse", tab: 2, frameId: 0 },
    });
    expect(m?.type).toBe("record");
    if (m?.type === "record") {
      expect(m.record).toMatchObject({ kind: "command-result", requestId: "r", playerId: 5, ok: false, reason: "sse", frameId: 0 });
    }
  });
});
