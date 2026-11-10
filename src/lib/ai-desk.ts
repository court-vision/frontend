/**
 * Where the AI desk is, in its URL. The side list has two sections: Conversations (the chats)
 * and Dime (its check-ins, its own moves, its memory, how moves went, its draft notes). Each Dime
 * view renders in the main area; a check-in (or a draft note) opens there as its conversation, with
 * Dime's Check-ins (or Draft notes) still selected.
 *
 *   /ai                    a new conversation
 *   /ai?c=12               conversation 12
 *   /ai?v=checkins         Dime's check-ins
 *   /ai?v=checkins&c=31    a check-in's conversation, opened from the check-ins
 *   /ai?v=moves            everything Dime sent itself, and what it held back
 *   /ai?v=memory           what Dime knows
 *   /ai?v=results          how moves went
 *   /ai?v=drafts           what Dime wrote in draft rooms
 *   /ai?v=drafts&c=40      a draft note's conversation, opened from Draft notes
 */

export type AiView = "chat" | "checkins" | "moves" | "memory" | "results" | "drafts";

export interface AiLocation {
  view: AiView;
  /** The open conversation: a chat, or (in the check-ins, or draft notes) one of Dime's. Null on the other views. */
  conversation: number | null;
}

/** The Dime views a conversation opens inside, by the conversation's kind. */
const HOME_OF_KIND: Record<string, AiView> = { checkin: "checkins", draft: "drafts" };

/** Where a conversation of this kind belongs: a check-in under Check-ins, a draft note under Draft notes, a chat under Conversations. */
export function viewOfKind(kind: string | null | undefined): AiView {
  return (kind && HOME_OF_KIND[kind]) || "chat";
}

/** A view that can hold an open conversation (a chat, a check-in's, a draft note's). */
export function holdsConversation(view: AiView): boolean {
  return view === "chat" || view === "checkins" || view === "drafts";
}

export const VIEW_LABEL: Record<Exclude<AiView, "chat">, string> = {
  checkins: "Check-ins",
  moves: "Dime's moves",
  memory: "Memory",
  results: "Move results",
  drafts: "Draft notes",
};

/** The location `?v=` and `?c=` name; anything unknown is a new conversation. */
export function aiLocation(v: string | null | undefined, c: string | null | undefined): AiLocation {
  const n = c ? Number(c) : NaN;
  const id = Number.isInteger(n) && n > 0 ? n : null;
  if (v === "moves" || v === "memory" || v === "results") return { view: v, conversation: null };
  if (v === "checkins" || v === "drafts") return { view: v, conversation: id };
  return { view: "chat", conversation: id };
}

/** The query string for a location: "" for a new conversation. */
export function aiSearch(loc: AiLocation): string {
  if (loc.view === "moves" || loc.view === "memory" || loc.view === "results") return `?v=${loc.view}`;
  if (loc.view === "checkins" || loc.view === "drafts") return loc.conversation != null ? `?v=${loc.view}&c=${loc.conversation}` : `?v=${loc.view}`;
  return loc.conversation != null ? `?c=${loc.conversation}` : "";
}

/** The main area shows a conversation (a chat, a check-in's, a draft note's), not one of Dime's lists. */
export function showsConversation(loc: AiLocation): boolean {
  return loc.view === "chat" || ((loc.view === "checkins" || loc.view === "drafts") && loc.conversation != null);
}
