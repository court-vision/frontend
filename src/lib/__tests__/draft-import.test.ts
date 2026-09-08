import { describe, expect, test } from "bun:test";
import { ApiError, PROVIDER_AUTH_EXPIRED } from "../api-error";
import { importFailure } from "../draft-import";

describe("importFailure", () => {
  test("an unfinished draft says when picks will appear", () => {
    const out = importFailure(
      new ApiError({ message: "Draft not complete", status: 409, code: "DRAFT_NOT_COMPLETE" })
    );
    expect(out.code).toBe("DRAFT_NOT_COMPLETE");
    expect(out.message).toContain("has not finished this draft yet");
    expect(out.existingSessionId).toBeNull();
    expect(out.reconnect).toBe(false);
  });

  test("a draft another room already follows points at that room", () => {
    const out = importFailure(
      new ApiError({
        message: "Another active draft room already follows that ESPN draft",
        status: 409,
        code: "DRAFT_ROOM_ALREADY_LINKED",
        data: { existing_session_id: 41 },
      })
    );
    expect(out.existingSessionId).toBe(41);
    expect(out.message).toBe("That ESPN draft is already in Draft #41.");
    const bare = importFailure(
      new ApiError({ message: "x", status: 409, code: "DRAFT_ROOM_ALREADY_LINKED" })
    );
    expect(bare.existingSessionId).toBeNull();
    expect(bare.message).toContain("already follows");
  });

  test("rejected credentials ask for a reconnect", () => {
    const out = importFailure(
      new ApiError({ message: "ESPN rejected the stored cookies", status: 401, code: PROVIDER_AUTH_EXPIRED })
    );
    expect(out.reconnect).toBe(true);
    expect(out.message.length).toBeGreaterThan(0);
  });

  test("a lost response keeps the room: the server may have finished the import", () => {
    for (const kind of ["network", "timeout"] as const) {
      const out = importFailure(new ApiError({ message: "lost", status: 0, kind }));
      expect(out.outcomeUnknown).toBe(true);
      expect(out.message).toContain("may already hold the draft");
      expect(out.existingSessionId).toBeNull();
    }
    const refused = importFailure(
      new ApiError({ message: "x", status: 409, code: "DRAFT_NOT_COMPLETE" })
    );
    expect(refused.outcomeUnknown).toBe(false);
  });

  test("anything else is the backend's own words, or a fallback", () => {
    const named = importFailure(
      new ApiError({ message: "Team Dunk Dynasty is not in the league", status: 400, code: "TEAM_NAME_NOT_IN_LEAGUE" })
    );
    expect(named.message).toBe("Team Dunk Dynasty is not in the league");
    expect(named.code).toBe("TEAM_NAME_NOT_IN_LEAGUE");
    const blank = importFailure(new Error(""));
    expect(blank.message).toBe("The draft could not be imported.");
    expect(blank.code).toBeNull();
  });
});
