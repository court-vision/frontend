import { describe, expect, test } from "bun:test";
import { openTick, type TapeBox, type TapeTick, type TickOpen } from "@/components/week/tape-box";

/** The box after each tick's asks in turn, as tickOf's setter applies them. */
function after(box: TapeBox, ...asks: Array<[TapeTick, TickOpen]>): TapeBox {
  return asks.reduce<TapeBox>((b, [tick, how]) => openTick(b, tick, how), box);
}

describe("openTick", () => {
  test("a tick opens its box however it is asked, and closes only its own", () => {
    expect(after(null, ["edge", "hover"])).toEqual({ tick: "edge", how: "hover" });
    expect(after(null, ["moves", "keyboard"])).toEqual({ tick: "moves", how: "keyboard" });
    expect(after({ tick: "moves", how: "pinned" }, ["moves", null])).toBeNull();
    expect(after({ tick: "moves", how: "pinned" }, ["edge", null])).toEqual({ tick: "moves", how: "pinned" });
  });

  test("resting on the other tick leaves a pinned or keyboard box open, and leaving it closes nothing", () => {
    for (const how of ["pinned", "keyboard"] as const) {
      const box: TapeBox = { tick: "moves", how };
      expect(after(box, ["edge", "hover"])).toEqual(box);
      expect(after(box, ["edge", "hover"], ["edge", null])).toEqual(box);
      expect(after({ tick: "edge", how }, ["moves", "hover"], ["moves", null])).toEqual({ tick: "edge", how });
    }
  });

  test("a hover's rest ending after a click on the same tick keeps the box pinned", () => {
    expect(after(null, ["edge", "pinned"], ["edge", "hover"])).toEqual({ tick: "edge", how: "pinned" });
  });

  test("a hover box gives way to the other tick's hover, and anything gives way to a click or a key", () => {
    expect(after({ tick: "moves", how: "hover" }, ["edge", "hover"])).toEqual({ tick: "edge", how: "hover" });
    expect(after({ tick: "moves", how: "pinned" }, ["edge", "pinned"])).toEqual({ tick: "edge", how: "pinned" });
    expect(after({ tick: "edge", how: "keyboard" }, ["moves", "keyboard"])).toEqual({ tick: "moves", how: "keyboard" });
  });
});
