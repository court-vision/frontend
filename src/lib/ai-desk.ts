/**
 * Where the AI desk is, in its URL. The side list has two sections: Conversations (the chats)
 * and Dime (its check-ins, its memory, how moves went). Each Dime view renders in the main
 * area; a check-in opens there as its conversation, with Dime's Check-ins still selected.
 *
 *   /ai                    a new conversation
 *   /ai?c=12               conversation 12
 *   /ai?v=checkins         Dime's check-ins
 *   /ai?v=checkins&c=31    a check-in's conversation, opened from the check-ins
 *   /ai?v=memory           what Dime knows
 *   /ai?v=results          how moves went
 */

export type AiView = "chat" | "checkins" | "memory" | "results";

export interface AiLocation {
  view: AiView;
  /** The open conversation: a chat, or (in the check-ins) a check-in's. Null on the other views. */
  conversation: number | null;
}

export const VIEW_LABEL: Record<Exclude<AiView, "chat">, string> = {
  checkins: "Check-ins",
  memory: "Memory",
  results: "Move results",
};

/** The location `?v=` and `?c=` name; anything unknown is a new conversation. */
export function aiLocation(v: string | null | undefined, c: string | null | undefined): AiLocation {
  const n = c ? Number(c) : NaN;
  const id = Number.isInteger(n) && n > 0 ? n : null;
  if (v === "memory" || v === "results") return { view: v, conversation: null };
  if (v === "checkins") return { view: "checkins", conversation: id };
  return { view: "chat", conversation: id };
}

/** The query string for a location: "" for a new conversation. */
export function aiSearch(loc: AiLocation): string {
  if (loc.view === "memory" || loc.view === "results") return `?v=${loc.view}`;
  if (loc.view === "checkins") return loc.conversation != null ? `?v=checkins&c=${loc.conversation}` : "?v=checkins";
  return loc.conversation != null ? `?c=${loc.conversation}` : "";
}

/** The main area shows a conversation (a chat, or a check-in's), not one of Dime's lists. */
export function showsConversation(loc: AiLocation): boolean {
  return loc.view === "chat" || (loc.view === "checkins" && loc.conversation != null);
}
