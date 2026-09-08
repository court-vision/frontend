/**
 * Pure logic for the Draft Recap page: how the finished draft's picks sort,
 * how a seat and its grade read, how a standings cell is toned, and what the
 * page has to caveat. Everything a component decides is decided here, so it
 * is testable without a DOM (the draft-board / draft-roster convention).
 *
 * Nothing here re-derives a grade, a rank or a roto point. The backend graded
 * the seats against each other and said on what (`meta.graded_by`); this
 * module only orders, labels and tones what it was told.
 */
import { recordOutcome, type Outcome } from "@/lib/category-format";
import type {
  PickSortKey,
  PickSource,
  RecapGradedBy,
  RecapH2HCell,
  RecapMeta,
  RecapPick,
  RecapSeat,
  RecapStanding,
  SortDirection,
} from "@/types/draft";

// ---- the pick table -------------------------------------------------------

/** Rank-like columns open ascending (pick 1 first); value-like ones descending. */
export const PICK_ASCENDING_BY_NATURE: PickSortKey[] = [
  "overall_pick",
  "round",
  "slot",
  "player_name",
  "team",
  "cv_rank",
  "adp",
];

export function pickNaturalDirection(key: PickSortKey): SortDirection {
  return PICK_ASCENDING_BY_NATURE.includes(key) ? "asc" : "desc";
}

/**
 * The sort value for a column. Missing data stays null so the comparator can
 * put it last in either direction — a pick nothing could value has no rank
 * and no surplus, and it should never sort as a zero.
 */
export function pickSortValue(pick: RecapPick, key: PickSortKey): number | string | null {
  switch (key) {
    case "overall_pick":
      return pick.overall_pick;
    case "round":
      return pick.round ?? null;
    case "slot":
      return pick.slot ?? null;
    case "player_name":
      return pick.player_name ? pick.player_name.toLowerCase() : null;
    case "team":
      return pick.team ? pick.team.toLowerCase() : null;
    case "value":
      return pick.value ?? null;
    case "cv_rank":
      return pick.cv_rank ?? null;
    case "surplus_cv":
      return pick.surplus_cv ?? null;
    case "adp":
      return pick.adp ?? null;
    case "surplus_market":
      return pick.surplus_market ?? null;
    case "value_over_slot":
      return pick.value_over_slot ?? null;
    case "bid":
      return pick.bid ?? null;
  }
}

/**
 * A sorted copy. Nulls last whichever way the column runs; ties (and two
 * nulls) keep draft order, so equal values never shuffle between renders.
 */
export function sortPicks(
  picks: RecapPick[],
  key: PickSortKey,
  direction: SortDirection
): RecapPick[] {
  const sign = direction === "asc" ? 1 : -1;
  const byOverall = (a: RecapPick, b: RecapPick) => a.overall_pick - b.overall_pick;
  return [...picks].sort((a, b) => {
    const av = pickSortValue(a, key);
    const bv = pickSortValue(b, key);
    if (av === null || bv === null) {
      if (av === null && bv === null) return byOverall(a, b);
      return av === null ? 1 : -1;
    }
    if (typeof av === "string" || typeof bv === "string") {
      const cmp = String(av).localeCompare(String(bv));
      return cmp === 0 ? byOverall(a, b) : cmp * sign;
    }
    if (av === bv) return byOverall(a, b);
    return av < bv ? -sign : sign;
  });
}

export interface PickColumn {
  key: PickSortKey;
  label: string;
  title?: string;
  align: "left" | "right" | "center";
  /** Tailwind width, applied to the header and the body cells alike. */
  className: string;
}

const BASE_PICK_COLUMNS: PickColumn[] = [
  { key: "overall_pick", label: "#", align: "right", className: "w-10", title: "Overall pick" },
  { key: "round", label: "Rd", align: "right", className: "w-10", title: "Round" },
  { key: "slot", label: "Seat", align: "left", className: "w-16", title: "The seat that made the pick" },
  { key: "player_name", label: "Player", align: "left", className: "min-w-[160px]" },
  { key: "team", label: "Team", align: "left", className: "w-12", title: "NBA team" },
  { key: "value", label: "Value", align: "right", className: "w-16",
    title: "Per-game value under this league's scoring" },
  { key: "cv_rank", label: "CV", align: "right", className: "w-12",
    title: "CV rank over the full pool, before the draft" },
  { key: "surplus_cv", label: "±CV", align: "right", className: "w-14",
    title: "CV rank − pick number; positive means he went later than his rank" },
  { key: "adp", label: "ADP", align: "right", className: "w-14",
    title: "Average draft position across real ESPN drafts" },
  { key: "surplus_market", label: "±ADP", align: "right", className: "w-14",
    title: "ADP − pick number; positive means he went later than ESPN's crowd took him" },
];

const VOS_COLUMN: PickColumn = {
  key: "value_over_slot",
  label: "VOS",
  align: "right",
  className: "w-16",
  title: "Value over slot: his value minus the value of the player CV ranked at this pick number",
};

const BID_COLUMN: PickColumn = {
  key: "bid",
  label: "Bid",
  align: "right",
  className: "w-14",
  title: "What the seat paid",
};

/** The columns, ending in VOS for a snake and the bid for an auction (which has no ladder to price a pick against). */
export function pickColumnsFor(meta: RecapMeta | null): PickColumn[] {
  return [...BASE_PICK_COLUMNS, meta?.draft_type === "auction" ? BID_COLUMN : VOS_COLUMN];
}

// ---- seats ---------------------------------------------------------------------

/** Seats carry no team names on the wire, so a seat is its slot — and "you" when it is. */
export function seatLabel(seat: Pick<RecapSeat, "slot" | "is_me">): string {
  return seat.is_me ? `Seat ${seat.slot} · you` : `Seat ${seat.slot}`;
}

export function seatTitle(seat: Pick<RecapSeat, "espn_team_id">): string | undefined {
  return seat.espn_team_id != null ? `ESPN team ${seat.espn_team_id}` : undefined;
}

/** The pick table's seat cell: the slot, marked when it is the caller's. */
export function slotLabel(slot: number | null | undefined, seats: Pick<RecapSeat, "slot" | "is_me">[]): string {
  if (slot === null || slot === undefined) return "—";
  const seat = seats.find((s) => s.slot === slot);
  return seat?.is_me ? `${slot} · you` : String(slot);
}

export function resolvePick(picks: RecapPick[], overall: number | null | undefined): RecapPick | null {
  if (overall === null || overall === undefined) return null;
  return picks.find((p) => p.overall_pick === overall) ?? null;
}

/** "N. Jokić (#1, +8.4)": the player, the pick, and what the pick was worth over its slot. */
export function pickLabel(pick: RecapPick | null): string {
  if (!pick) return "—";
  const name = pick.player_name ?? `Pick ${pick.overall_pick}`;
  const vos = pick.value_over_slot;
  return vos === null || vos === undefined
    ? `${name} (#${pick.overall_pick})`
    : `${name} (#${pick.overall_pick}, ${signed(vos)})`;
}

export function ordinal(n: number): string {
  const whole = Math.round(n);
  const abs = Math.abs(whole);
  const suffix =
    abs % 100 >= 11 && abs % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][abs % 10] ?? "th");
  return `${whole}${suffix}`;
}

/**
 * "3rd", or "T-2nd" for a tie. The backend averages tied positions, so a
 * two-way tie for second reads 2.5 and a three-way tie for second reads 3 —
 * an integer that alone cannot say it was a tie. The peers decide: equal
 * positions are a tie, and the letter is the best place the tie spans.
 */
export function positionLabel(
  position: number | null | undefined,
  peers: (number | null | undefined)[]
): string {
  if (position === null || position === undefined) return "—";
  const tied = peers.filter((p) => p === position).length;
  if (tied > 1) return `T-${ordinal(position - (tied - 1) / 2)}`;
  return ordinal(position);
}

export type GradeTone = "win" | "good" | "mid" | "poor" | "loss" | "none";

/** A letter's tone. Two shades each side of neutral; anything unexpected is toneless. */
export function gradeTone(grade: string | null | undefined): GradeTone {
  switch ((grade ?? "").toUpperCase()) {
    case "A":
      return "win";
    case "B":
      return "good";
    case "C":
      return "mid";
    case "D":
      return "poor";
    case "F":
      return "loss";
    default:
      return "none";
  }
}

/** What a seat's headline number is: summed value over slot, or total value in an auction. */
export function gradedTotal(
  seat: Pick<RecapSeat, "value_over_slot" | "total_value">,
  gradedBy: RecapGradedBy | null | undefined
): number | null {
  if (gradedBy === "value") return seat.total_value;
  return seat.value_over_slot ?? null;
}

export function gradedLabel(gradedBy: RecapGradedBy | null | undefined): { short: string; title: string } {
  if (gradedBy === "value") {
    return {
      short: "Σ value",
      title:
        "Total value drafted. An auction has no pick ladder to price a pick against, so seats grade on what they bought",
    };
  }
  return {
    short: "Σ VOS",
    title:
      "Summed value over slot: what each pick was worth against the player CV ranked at that pick number",
  };
}

/** The headline number as text: signed for a surplus, plain for a total, a dash for nothing. */
export function formatGradedTotal(
  total: number | null,
  gradedBy: RecapGradedBy | null | undefined
): string {
  if (total === null) return "—";
  return gradedBy === "value" ? total.toFixed(0) : signed(total);
}

// ---- standings ------------------------------------------------------------------

export type RankTone = "high" | "mid" | "low";

/**
 * Where a rank sits among the seats, in tertiles of the field so the tint
 * means the same thing in a 4-team room and a 12-team one. Null for no rank;
 * one seat is neither high nor low.
 */
export function rankTone(rank: number | null | undefined, seats: number): RankTone | null {
  if (rank === null || rank === undefined) return null;
  if (seats <= 1) return "mid";
  const share = (rank - 1) / (seats - 1);
  if (share <= 1 / 3) return "high";
  if (share >= 2 / 3) return "low";
  return "mid";
}

export type StandingsMode = "categories" | "points" | "none";

/** Which standings the recap carries: per-category roto for a category league, projected value otherwise. */
export function standingsMode(meta: RecapMeta | null, standings: RecapStanding[]): StandingsMode {
  if (standings.length === 0) return "none";
  if (meta?.standings_basis === "z_sum" && (meta.categories?.length ?? 0) > 0) return "categories";
  return "points";
}

function nullsLast(a: number | null | undefined, b: number | null | undefined): number {
  const av = a ?? null;
  const bv = b ?? null;
  if (av === null && bv === null) return 0;
  if (av === null) return 1;
  if (bv === null) return -1;
  return av - bv;
}

/** Seats best first; ungraded seats last, then by slot. */
export function sortSeats(seats: RecapSeat[]): RecapSeat[] {
  return [...seats].sort((a, b) => nullsLast(a.position, b.position) || a.slot - b.slot);
}

/** Standings best first by the rank the mode reads; unranked last, then by slot. */
export function sortStandings(standings: RecapStanding[], mode: StandingsMode): RecapStanding[] {
  const rank = (s: RecapStanding) => (mode === "categories" ? s.roto_rank : s.value_rank);
  return [...standings].sort((a, b) => nullsLast(rank(a), rank(b)) || a.slot - b.slot);
}

export function h2hCell(standing: RecapStanding, opponentSlot: number): RecapH2HCell | null {
  return standing.h2h.find((cell) => cell.opponent_slot === opponentSlot) ?? null;
}

export function h2hOutcome(cell: Pick<RecapH2HCell, "won" | "lost">): Outcome {
  return recordOutcome(cell.won, cell.lost);
}

// ---- the page's caveats ---------------------------------------------------------

export interface RecapCaveat {
  key: string;
  text: string;
  tone: "info" | "warn";
}

/**
 * What the page must say before the numbers: whom the grades are against,
 * what an auction grades on, and what the draft did not record or value.
 */
export function recapCaveats(meta: RecapMeta | null, seatCount: number): RecapCaveat[] {
  if (!meta) return [];
  const out: RecapCaveat[] = [];
  if (seatCount > 0) {
    out.push({
      key: "graded",
      tone: "info",
      text: `Graded against the ${seatCount} seat${seatCount === 1 ? "" : "s"} in this room, not the whole league`,
    });
  }
  if (meta.graded_by === "value") {
    out.push({
      key: "auction",
      tone: "info",
      text: "An auction has no pick ladder to price a pick against, so seats grade on total value",
    });
  }
  if (!meta.complete) {
    const total = meta.total_picks ?? "?";
    const why = meta.status === "active" ? "the draft is still going" : "the draft stopped early";
    out.push({
      key: "incomplete",
      tone: "warn",
      text: `${meta.picks_made} of ${total} picks recorded — ${why}; grades cover what was drafted`,
    });
  }
  if (meta.unscored > 0) {
    out.push({
      key: "unscored",
      tone: "warn",
      text: `${meta.unscored} pick${meta.unscored === 1 ? "" : "s"} nothing could value — listed, left out of every sum`,
    });
  }
  if (meta.unattributed > 0) {
    out.push({
      key: "unattributed",
      tone: "warn",
      text: `${meta.unattributed} pick${meta.unattributed === 1 ? "" : "s"} with no seat — this room never learned its pick order`,
    });
  }
  return out;
}

/** "projections 2026-09-01 · market 2026-09-05", or null when neither snapshot is dated. */
export function asOfLabel(meta: RecapMeta | null): string | null {
  if (!meta) return null;
  const parts: string[] = [];
  if (meta.projections_as_of) parts.push(`projections ${meta.projections_as_of}`);
  if (meta.market_as_of) parts.push(`market ${meta.market_as_of}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

// ---- odds and ends ---------------------------------------------------------------

/** A one-letter provenance mark for a pick that did not come from the keyboard. */
export function pickSourceGlyph(source: PickSource): { glyph: string; title: string } | null {
  switch (source) {
    case "keeper":
      return { glyph: "K", title: "Keeper — spent before the draft started" };
    case "import":
      return { glyph: "I", title: "Imported from the completed ESPN draft" };
    case "mock":
      return { glyph: "M", title: "Played by the mock autopicker" };
    case "espn_sync":
      return { glyph: "E", title: "Synced live from the ESPN draft room" };
    default:
      return null;
  }
}

/** "+3.2" / "-1.0" / "—": a signed number, or a dash for nothing. */
export function signed(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return "—";
  return value > 0 ? `+${value.toFixed(decimals)}` : value.toFixed(decimals);
}
