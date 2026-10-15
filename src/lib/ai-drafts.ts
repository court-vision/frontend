/**
 * Unsent messages in the AI desk, one per conversation (and one for a new
 * conversation), kept in this browser so leaving the desk and coming back
 * finds the message where it was. A convenience only: storage can be blocked
 * or cleared, and then the draft is simply gone.
 */

const PREFIX = "cv.ai.draft.";
/** Older drafts are dropped once there are more than this many. */
const MAX_DRAFTS = 40;

export function draftKey(userId: string | null | undefined, conversationId: number | null): string | null {
  if (!userId) return null;
  return `${PREFIX}${userId}.${conversationId ?? "new"}`;
}

export function loadDraft(key: string | null): string {
  if (!key) return "";
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { text?: unknown };
    return typeof parsed.text === "string" ? parsed.text : "";
  } catch {
    return "";
  }
}

export function saveDraft(key: string | null, text: string): void {
  if (!key) return;
  try {
    if (!text.trim()) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify({ text, at: Date.now() }));
    prune();
  } catch {
    // Storage full or blocked: the draft lives only as long as the page
  }
}

function prune(): void {
  const drafts: Array<[string, number]> = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    try {
      drafts.push([key, (JSON.parse(window.localStorage.getItem(key) ?? "{}") as { at?: number }).at ?? 0]);
    } catch {
      drafts.push([key, 0]);
    }
  }
  if (drafts.length <= MAX_DRAFTS) return;
  drafts.sort((a, b) => a[1] - b[1]);
  for (const [key] of drafts.slice(0, drafts.length - MAX_DRAFTS)) window.localStorage.removeItem(key);
}
