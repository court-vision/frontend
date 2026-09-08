/**
 * What the import dialog says when a completed draft cannot be folded in.
 * Pure: the dialog hands over the error and this decides the copy, so each
 * refusal the backend documents has a line here and a test behind it.
 */
import { PROVIDER_AUTH_EXPIRED, toApiError, userMessage } from "@/lib/api-error";

export interface ImportFailure {
  code: string | null;
  message: string;
  /** The room that already follows this ESPN draft, when that is the refusal. */
  existingSessionId: number | null;
  /** The stored ESPN credentials were rejected: point at Manage Teams. */
  reconnect: boolean;
}

export function importFailure(error: unknown): ImportFailure {
  const api = toApiError(error);
  const code = api.code;
  const data = (api.data ?? null) as { existing_session_id?: unknown } | null;
  const existing =
    typeof data?.existing_session_id === "number" ? data.existing_session_id : null;
  switch (code) {
    case "DRAFT_NOT_COMPLETE":
      return {
        code,
        message:
          "ESPN has not finished this draft yet — picks appear only when the draft completes.",
        existingSessionId: null,
        reconnect: false,
      };
    case "DRAFT_ROOM_ALREADY_LINKED":
      return {
        code,
        message:
          existing !== null
            ? `That ESPN draft is already in Draft #${existing}.`
            : "Another room already follows that ESPN draft.",
        existingSessionId: existing,
        reconnect: false,
      };
    case PROVIDER_AUTH_EXPIRED:
      return { code, message: userMessage(error), existingSessionId: null, reconnect: true };
    default:
      return {
        code,
        message: userMessage(error, "The draft could not be imported."),
        existingSessionId: null,
        reconnect: false,
      };
  }
}
