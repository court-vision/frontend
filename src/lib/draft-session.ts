import type { DraftSession } from "@/types/draft";

/** A room's title: its name, else what kind of room it is. */
export function sessionTitle(session: Pick<DraftSession, "id" | "name" | "kind">): string {
  if (session.name) return session.name;
  if (session.kind === "mock") return "Mock draft";
  if (session.kind === "live") return "Live draft";
  if (session.kind === "import") return "Imported draft";
  return `Draft #${session.id}`;
}
