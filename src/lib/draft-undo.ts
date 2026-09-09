/**
 * Who owns a pick, and may therefore unrecord it.
 *
 * Mirrors `pick_is_undoable` in the backend's `draft_service.py`. As with
 * `draft-mock`, this is not a second opinion — the server still decides, and a
 * refusal there is the one the user would have seen anyway — but an undo
 * control that is simply absent beats one that round-trips to a 400, and the
 * two facts it needs (`espn_league_id` on the session, `source` on the pick)
 * are already on both.
 *
 * The rule exists because the WS7 mock-lobby E2E walked into the failure: ⌘Z on
 * a pick ESPN had made removed it from the room, which reaches ESPN not at all,
 * and the next INIT reconcile put it straight back. An undo that un-undoes
 * itself is worse than one that refuses.
 */
import type { DraftPick, DraftSession } from "@/types/draft";

/** Sources Court Vision recorded itself. Everything else came from ESPN. */
const CV_OWNED_SOURCES: ReadonlySet<DraftPick["source"]> = new Set(["manual", "mock"]);

/** Whether this room follows one ESPN draft, and so does not own what ESPN recorded. */
export function followsEspnDraft(session: DraftSession): boolean {
  return session.espn_league_id !== null && session.espn_league_id !== undefined;
}

export function pickIsUndoable(session: DraftSession, pick: DraftPick): boolean {
  if (!followsEspnDraft(session)) return true;
  return CV_OWNED_SOURCES.has(pick.source);
}

/**
 * Why this pick cannot be undone, or null when it can. Shown when someone
 * reaches for ⌘Z — which is the moment the explanation is worth having, and the
 * reason the per-pick control is hidden rather than disabled: in a live draft
 * every ESPN row would otherwise carry a dead button.
 */
export function undoBlocker(session: DraftSession, pick: DraftPick): string | null {
  if (pickIsUndoable(session, pick)) return null;
  if (pick.source === "keeper") {
    return "ESPN named this keeper, so the room cannot unrecord it — edit keepers instead";
  }
  return "ESPN made this pick, so the room cannot unmake it — only a commissioner's undo in ESPN can, and the room follows that";
}
