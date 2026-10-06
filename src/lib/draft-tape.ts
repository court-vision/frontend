/**
 * The draft as a tape: every pick number in order, made or still to come, and
 * whose it is. The room draws it as a timeline; the ticker reads the clock off it.
 *
 * Seats for picks still to come follow snake geometry. That is display only:
 * the numbers the room is judged on (`my_next_pick`, `picks_until_my_turn`)
 * stay the server's, and when the geometry disagrees with them the tape stops
 * claiming which future picks are yours rather than show a second opinion.
 */
import type { DraftPick, DraftSession } from "@/types/draft";

export interface TapeCell {
  /** 1-based overall pick number. */
  overall: number;
  round: number | null;
  /** 1-based seat in the pick order, when known. */
  seat: number | null;
  mine: boolean;
  pick: DraftPick | null;
  state: "made" | "now" | "next";
}

/** Round and seat of an overall pick in a snake draft of `size` seats. */
export function snakeSeat(overall: number, size: number): { round: number; seat: number } {
  const round = Math.ceil(overall / size);
  const index = (overall - 1) % size;
  return { round, seat: round % 2 === 1 ? index + 1 : size - index };
}

type TapeSession = Pick<
  DraftSession,
  "picks" | "next_overall_pick" | "total_picks" | "league_size" | "my_slot" | "my_next_pick" | "draft_type" | "status"
>;

/**
 * Every pick of the draft. A room that does not know its length (no order or
 * no rounds) shows what was recorded plus the next pick.
 */
export function buildTape(session: TapeSession): TapeCell[] {
  const byOverall = new Map(session.picks.map((p) => [p.overall_pick, p]));
  const recordedMax = session.picks.reduce((m, p) => Math.max(m, p.overall_pick), 0);
  const total = Math.max(session.total_picks ?? 0, recordedMax, session.status === "active" ? session.next_overall_pick : 0);
  const size = session.league_size ?? null;
  const snake = session.draft_type === "snake" && size != null && size > 0;

  const cells: TapeCell[] = [];
  for (let n = 1; n <= total; n++) {
    const pick = byOverall.get(n) ?? null;
    const geo = snake ? snakeSeat(n, size) : null;
    const seat = pick?.slot ?? geo?.seat ?? null;
    cells.push({
      overall: n,
      round: pick?.round ?? geo?.round ?? null,
      seat,
      mine: pick ? pick.by_me : session.my_slot != null && seat === session.my_slot,
      pick,
      state: pick ? "made" : session.status === "active" && n === session.next_overall_pick ? "now" : "next",
    });
  }

  // The server's next turn of mine is the authority. If the geometry puts it
  // elsewhere, keep only the server's pick marked rather than guess the rest.
  const firstMine = cells.find((c) => c.state !== "made" && c.mine);
  if (session.my_next_pick != null && firstMine && firstMine.overall !== session.my_next_pick) {
    for (const c of cells) if (c.state !== "made") c.mine = c.overall === session.my_next_pick;
  }
  return cells;
}

/** My next turns after the current front, up to `count`, as the tape knows them. */
export function myUpcoming(cells: TapeCell[], count = 2): number[] {
  return cells.filter((c) => c.state !== "made" && c.mine).slice(0, count).map((c) => c.overall);
}
