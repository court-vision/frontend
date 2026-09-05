/**
 * Mock-mode rules: which rooms the autopicker will play, whether running it to
 * the end needs asking first, and what to say when it stops.
 *
 * The refusals mirror `DraftMockService._check_simulatable` on purpose. They
 * are not a second opinion — the server still decides — but a button that
 * explains why it is disabled beats one that round-trips to a 409, and the
 * facts it needs (`kind`, `espn_league_id`, `status`, `draft_type`,
 * `total_picks`) are all on the session already.
 *
 * The snake arithmetic is deliberately *not* reimplemented here: `my_next_pick`
 * and `picks_until_my_turn` come off the session, and a second copy of the
 * pick geometry in the client would be a second source of truth for the one
 * number the room is judged on.
 */
import type { DraftSession, MockAdvance } from "@/types/draft";

/**
 * Why this room cannot be simulated at all, or null when it can. In the
 * server's own order, so the message the user sees is the one they would have
 * got from the API.
 */
export function mockBlocker(session: DraftSession): string | null {
  if (session.kind !== "mock") {
    return `Only a mock room can be simulated — this one is a ${session.kind} room tracking a real draft`;
  }
  if (session.espn_league_id !== null && session.espn_league_id !== undefined) {
    return `This room follows ESPN draft ${session.espn_league_id}; its picks come from there`;
  }
  if (session.status !== "active") {
    return `This draft is ${session.status}`;
  }
  if (session.draft_type !== "snake") {
    return "The autopicker drafts by draft order and has no bidding model — auction rooms are entered by hand";
  }
  if (!session.total_picks) {
    return "This room has no pick order or round count, so there is nothing to run to";
  }
  return null;
}

/**
 * Why "sim to my pick" specifically cannot run. Running to the *end* without a
 * slot is legitimate — nothing is yours and the whole draft plays — but
 * stopping at your turn needs a turn to stop at.
 */
export function mockMyTurnBlocker(session: DraftSession): string | null {
  const blocker = mockBlocker(session);
  if (blocker !== null) return blocker;
  if (session.my_slot === null || session.my_slot === undefined) {
    return "This room has no seat of yours to stop at — set your slot, or simulate to the end";
  }
  return null;
}

/**
 * Whether running to the end would hand the autopicker a seat of the caller's.
 *
 * `until: "end"` plays every remaining pick, the caller's included, and records
 * those as theirs. That is worth asking about once; when there is no turn of
 * theirs left it is just the tail of someone else's draft, and asking would be
 * noise.
 */
export function needsSeatConfirm(session: DraftSession): boolean {
  return (
    session.my_slot !== null &&
    session.my_slot !== undefined &&
    session.my_next_pick !== null &&
    session.my_next_pick !== undefined
  );
}

/** What the room says after an advance: what happened, and how it was drafted. */
export function mockAdvanceToast(result: MockAdvance): { title: string; description: string } {
  const made = result.picks_made;
  const plural = made === 1 ? "" : "s";

  const stopped = (() => {
    switch (result.stopped_reason) {
      case "my_turn":
        return `You are on the clock at pick ${result.stopped_at}.`;
      case "end":
        return result.completed ? "The mock is finished." : "Ran to the end of the draft.";
      case "pool_exhausted":
        return `Stopped at pick ${result.stopped_at} — nothing draftable is left.`;
      case "cap_blocked":
        return `Stopped at pick ${result.stopped_at} — every remaining player would break that seat's position caps.`;
    }
  })();

  // Not a warning: on a database with no market snapshot this is every run, and
  // it is a statement of method rather than something being wrong.
  const source = result.fallback
    ? " Seats drafted by CV value: no ESPN market snapshot for this season yet."
    : result.market_as_of
      ? ` Seats drafted by ADP as of ${result.market_as_of}.`
      : "";

  if (made === 0) {
    return result.stopped_reason === "my_turn"
      ? { title: "Already on the clock", description: `Pick ${result.stopped_at} is yours.` }
      : { title: "Nothing to simulate", description: stopped };
  }

  return { title: `${made} pick${plural} simulated`, description: `${stopped}${source}` };
}
