/**
 * Undo ownership. The refusals mirror the server's `pick_is_undoable`, so these
 * tests double as the record of that contract — if the backend's rule moves,
 * this is where it should be noticed.
 */
import { describe, expect, test } from "bun:test";
import { followsEspnDraft, pickIsUndoable, undoBlocker } from "../draft-undo";
import type { DraftPick, DraftSession } from "../../types/draft";

const session = (espn_league_id: number | null) => ({ espn_league_id } as DraftSession);
const pick = (source: DraftPick["source"]) => ({ source, overall_pick: 1 } as DraftPick);

describe("a room that follows nothing", () => {
  test.each(["manual", "mock", "keeper", "espn_sync", "import"] as const)(
    "owns its %s pick",
    (source) => {
      expect(pickIsUndoable(session(null), pick(source))).toBe(true);
      expect(undoBlocker(session(null), pick(source))).toBeNull();
    }
  );

  test("is not following an ESPN draft", () => {
    expect(followsEspnDraft(session(null))).toBe(false);
  });
});

describe("a room that follows an ESPN draft", () => {
  const tracked = session(426893737);

  test.each(["manual", "mock"] as const)("still undoes its own %s pick", (source) => {
    expect(pickIsUndoable(tracked, pick(source))).toBe(true);
  });

  test.each(["espn_sync", "import"] as const)("refuses ESPN's %s pick", (source) => {
    expect(pickIsUndoable(tracked, pick(source))).toBe(false);
    expect(undoBlocker(tracked, pick(source))).toContain("commissioner");
  });

  test("points a keeper at the keeper editor rather than the commissioner", () => {
    expect(pickIsUndoable(tracked, pick("keeper"))).toBe(false);
    expect(undoBlocker(tracked, pick("keeper"))).toContain("edit keepers");
  });
});
