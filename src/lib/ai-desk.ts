/**
 * Where the AI desk is, in its URL. The desk is two half panes: on the left the team's day on a
 * timeline (or its Notebook, or how its moves went), on the right the chat. Opening a check-in
 * from the timeline opens its conversation in the chat. Either pane can be expanded; that is the
 * desk's own state, not the URL's.
 *
 *   /ai                       today's timeline, a new conversation
 *   /ai?c=12                  conversation 12 (a chat or a check-in's) in the chat pane
 *   /ai?d=2026-11-19          that fantasy day on the timeline
 *   /ai?v=notebook            the Notebook in the left pane (?v=results: how moves went)
 *
 * The links of the desk before it (?v=checkins, moves, memory, results with or without ?c=)
 * land on the closest place in this one; ?v=drafts went to each room's recap (`draftsRedirect`).
 */

export type AiPaneView = "timeline" | "notebook" | "results";

export interface AiLocation {
  /** What the left pane shows. */
  view: AiPaneView;
  /** The conversation open in the chat pane: a chat or a check-in's. Null for a new one. */
  conversation: number | null;
  /** The fantasy day on the timeline, YYYY-MM-DD; null for today. */
  day: string | null;
}

export const PANE_LABEL: Record<AiPaneView, string> = {
  timeline: "Timeline",
  notebook: "Notebook",
  results: "Move results",
};

/** The old desk's views, each to the pane that holds it now (a Map, so `?v=constructor` is unknown). */
const OLD_VIEW = new Map<string, AiPaneView>([
  ["checkins", "timeline"],
  ["moves", "timeline"],
  ["memory", "notebook"],
  ["results", "results"],
  ["drafts", "timeline"],
]);

function readDay(d: string | null | undefined): string | null {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = Date.parse(`${d}T12:00:00Z`);
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== d ? null : d;
}

function readId(c: string | null | undefined): number | null {
  const n = c ? Number(c) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** The location `?v=`, `?c=` and `?d=` name; anything unknown is today's timeline and a new conversation. */
export function aiLocation(v: string | null | undefined, c: string | null | undefined, d?: string | null): AiLocation {
  const view: AiPaneView = v === "notebook" || v === "results" ? v : (v && OLD_VIEW.get(v)) || "timeline";
  return { view, conversation: readId(c), day: readDay(d) };
}

/** The query string for a location: "" for today's timeline with a new conversation. */
export function aiSearch(loc: AiLocation): string {
  const q = new URLSearchParams();
  if (loc.view !== "timeline") q.set("v", loc.view);
  if (loc.day) q.set("d", loc.day);
  if (loc.conversation != null) q.set("c", String(loc.conversation));
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * Where an old Draft notes link goes now that draft notes live on each room's recap: a note's
 * conversation opens in the chat; the list itself is the Draft desk's rooms. Null for any other link.
 */
export function draftsRedirect(v: string | null | undefined, c: string | null | undefined, draftDesk: string, aiDesk: string): string | null {
  if (v !== "drafts") return null;
  const id = readId(c);
  return id != null ? `${aiDesk}?c=${id}` : draftDesk;
}

/** Which panes show: both, or the one expanded. */
export type AiExpand = "none" | "timeline" | "chat";

/** The E key: split, then the timeline alone, then the chat alone, then split again. */
export function nextExpand(e: AiExpand): AiExpand {
  return e === "none" ? "timeline" : e === "timeline" ? "chat" : "none";
}
