/**
 * The Draft desk's demo: a whole draft run in the browser.
 *
 * The pool is a real board snapshot (a league-less 10-team room on the dev
 * database, `src/__fixtures__/draft-demo/`); everything that moves with a pick
 * — availability, the room-aware score, category need, fit, the autopicker,
 * the recap's grades — is computed here, approximately. It exists so the desk
 * can be seen and exercised without an account, and nothing in it is sent
 * anywhere. The server stays the authority for real rooms.
 */
import { snakeSeat } from "./draft-tape";
import type {
  CategoryNeed,
  DraftBoardMeta,
  DraftBoardResult,
  DraftBoardRow,
  DraftKeeper,
  DraftKeeperOut,
  DraftPick,
  DraftPickCreate,
  DraftRecapResult,
  DraftRecommendation,
  DraftRosterEntry,
  DraftSession,
  BoardSource,
  MockAdvance,
  MockUntil,
  RecapPick,
  RecapSeat,
  RecapStanding,
  RecommendationComponent,
} from "@/types/draft";

export type DemoFormat = "points" | "categories";

export interface DemoFixture {
  rows: DraftBoardRow[];
  meta: DraftBoardMeta;
  recommendations: DraftRecommendation[];
  message: string;
}

export interface DemoPick {
  overall: number;
  playerId: number;
  byMe: boolean;
  source: DraftPick["source"];
}

export interface DemoRoom {
  /** Negative, so it can never collide with a real session id. */
  id: number;
  name: string | null;
  format: DemoFormat;
  size: number;
  rounds: number;
  mySlot: number | null;
  picks: DemoPick[];
  punts: string[];
  keepers: DraftKeeper[];
  status: DraftSession["status"];
  createdAt: number;
  updatedAt: number;
}

/** The URL segment for a demo room: `/lab/demo-3`. */
export const demoSlug = (id: number) => `demo-${Math.abs(id)}`;
export function demoIdFromSlug(slug: string): number | null {
  const m = /^demo-(\d+)$/.exec(slug);
  return m ? -Number(m[1]) : null;
}

/** The pool holds 200 players; a draft may use at most that many picks. */
export const DEMO_POOL = 200;

export function newDemoRoom(
  id: number,
  opts: { format: DemoFormat; size: number; rounds: number; mySlot: number | null; name?: string | null },
  now = Date.now()
): DemoRoom {
  const size = Math.max(2, Math.min(16, Math.round(opts.size)));
  const rounds = Math.max(1, Math.min(Math.floor(DEMO_POOL / size), Math.round(opts.rounds)));
  const mySlot = opts.mySlot != null && opts.mySlot >= 1 && opts.mySlot <= size ? opts.mySlot : null;
  return {
    id,
    name: opts.name ?? null,
    format: opts.format,
    size,
    rounds,
    mySlot,
    picks: [],
    punts: [],
    keepers: [],
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

const total = (room: DemoRoom) => room.size * room.rounds;

/** The lowest pick number nobody has used: where the next pick lands. */
function front(room: DemoRoom): number {
  const used = new Set(room.picks.map((p) => p.overall));
  for (let n = 1; n <= total(room); n++) if (!used.has(n)) return n;
  return total(room) + 1;
}

function seatOf(room: DemoRoom, overall: number): number {
  return snakeSeat(overall, room.size).seat;
}

function myNextPick(room: DemoRoom): number | null {
  if (room.mySlot == null || room.status !== "active") return null;
  const used = new Set(room.picks.map((p) => p.overall));
  for (let n = front(room); n <= total(room); n++) {
    if (!used.has(n) && seatOf(room, n) === room.mySlot) return n;
  }
  return null;
}

/** The pick a keeper costs: the caller's own pick in its round. */
export function keeperPick(room: DemoRoom, round: number | null | undefined): number | null {
  if (round == null || room.mySlot == null || round < 1 || round > room.rounds) return null;
  const index = round % 2 === 1 ? room.mySlot : room.size - room.mySlot + 1;
  return (round - 1) * room.size + index;
}

export function demoSession(room: DemoRoom, fixture: DemoFixture): DraftSession {
  const byId = rowsById(fixture);
  const next = front(room);
  const mine = myNextPick(room);
  const iso = (ms: number) => new Date(ms).toISOString();
  const picks: DraftPick[] = [...room.picks]
    .sort((a, b) => a.overall - b.overall)
    .map((p) => {
      const row = byId.get(p.playerId);
      const geo = snakeSeat(p.overall, room.size);
      return {
        overall_pick: p.overall,
        round: geo.round,
        slot: geo.seat,
        player_id: p.playerId,
        espn_player_id: row?.espn_id ?? null,
        espn_team_id: null,
        player_name: row?.name ?? null,
        by_me: p.byMe,
        source: p.source,
        bid: null,
        created_at: null,
      };
    });
  const keepers: DraftKeeperOut[] = room.keepers.map((k) => ({
    player_id: k.player_id ?? null,
    espn_player_id: k.espn_player_id ?? null,
    name: k.name ?? null,
    round: k.round ?? null,
    overall_pick: keeperPick(room, k.round),
  }));
  return {
    id: room.id,
    team_id: null,
    league_id: null,
    kind: "mock",
    status: room.status,
    name: room.name,
    espn_league_id: null,
    draft_type: "snake",
    pick_order: Array.from({ length: room.size }, (_, i) => i + 1),
    my_slot: room.mySlot,
    rounds: room.rounds,
    keepers,
    punts: room.punts,
    scoring_format: room.format,
    league_size: room.size,
    keeper_count: null,
    total_picks: total(room),
    pick_count: room.picks.length,
    next_overall_pick: next,
    my_next_pick: mine,
    picks_until_my_turn: mine != null ? mine - next : null,
    picks,
    started_at: room.picks.length ? iso(room.createdAt) : null,
    completed_at: room.status === "completed" ? iso(room.updatedAt) : null,
    created_at: iso(room.createdAt),
    updated_at: iso(room.updatedAt),
  };
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

const idCache = new WeakMap<DemoFixture, Map<number, DraftBoardRow>>();
function rowsById(fixture: DemoFixture): Map<number, DraftBoardRow> {
  let map = idCache.get(fixture);
  if (!map) {
    map = new Map(fixture.rows.map((r) => [r.player_id, r]));
    idCache.set(fixture, map);
  }
  return map;
}

const seasonValue = (r: DraftBoardRow) => (r.value ?? 0) * (r.season_games ?? r.projected_gp ?? 65);

function activeStarters(meta: DraftBoardMeta): number {
  return Object.entries(meta.roster_slots ?? {})
    .filter(([slot]) => !["BE", "BN", "IR", "IL"].includes(slot.toUpperCase()))
    .reduce((s, [, n]) => s + Number(n || 0), 0);
}

/** Category sums per seat, over each seat's first `k` picks (all picks when k is null). */
function seatSums(room: DemoRoom, fixture: DemoFixture, keys: string[], k: number | null): Map<number, Record<string, number>> {
  const byId = rowsById(fixture);
  const out = new Map<number, Record<string, number>>();
  const bySeat = new Map<number, DemoPick[]>();
  for (const p of [...room.picks].sort((a, b) => a.overall - b.overall)) {
    const seat = seatOf(room, p.overall);
    bySeat.set(seat, [...(bySeat.get(seat) ?? []), p]);
  }
  for (const [seat, picks] of bySeat) {
    const sums: Record<string, number> = Object.fromEntries(keys.map((key) => [key, 0]));
    for (const p of k == null ? picks : picks.slice(0, k)) {
      const z = byId.get(p.playerId)?.category_z ?? null;
      if (z) for (const key of keys) sums[key] += z[key] ?? 0;
    }
    out.set(seat, sums);
  }
  return out;
}

function categoryNeed(room: DemoRoom, fixture: DemoFixture): { needs: CategoryNeed[]; seatsDrafted: number } {
  const defs = fixture.meta.categories ?? [];
  if (!defs.length) return { needs: [], seatsDrafted: 0 };
  const keys = defs.map((d) => d.key);
  const myCount = room.picks.filter((p) => p.byMe).length;
  const sums = seatSums(room, fixture, keys, Math.max(1, myCount));
  const mine = room.mySlot != null ? sums.get(room.mySlot) ?? null : null;
  const others = [...sums.entries()].filter(([seat]) => seat !== room.mySlot).map(([, s]) => s);
  const seats = sums.size + (mine ? 0 : room.mySlot != null ? 1 : 0);
  const needs = defs.map((def) => {
    const m = mine?.[def.key] ?? 0;
    const vals = others.map((o) => o[def.key] ?? 0);
    const pace = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const spread = vals.length > 1 ? Math.sqrt(vals.reduce((a, v) => a + (v - pace) ** 2, 0) / vals.length) : 1;
    const punted = room.punts.includes(def.key);
    const need = myCount === 0 ? 0 : Math.max(-2, Math.min(2, (pace - m) / Math.max(spread, 0.75)));
    const rank = mine ? 1 + vals.filter((v) => v > m).length : null;
    return {
      key: def.key,
      label: def.label,
      mine: round(m, 2),
      pace: round(pace, 2),
      need: round(need, 2),
      weight: punted ? 0 : round(Math.max(0.4, Math.min(1.8, 1 + 0.35 * need)), 2),
      punted,
      my_rank: myCount > 0 ? rank : null,
      seats: myCount > 0 ? seats : null,
    };
  });
  return { needs, seatsDrafted: others.length };
}

const round = (v: number, places = 1) => Math.round(v * 10 ** places) / 10 ** places;

interface Scored {
  row: DraftBoardRow;
  sv: number;
  vorp: number;
  injury: number;
  punts: number;
  fit: number;
  score: number;
}

function injuryShare(status: string | null | undefined): number {
  const s = (status ?? "").toUpperCase();
  if (!s || s === "ACTIVE") return 0;
  if (s === "OUT" || s.includes("INJURY")) return 0.22;
  return 0.07;
}

function score(rows: DraftBoardRow[], room: DemoRoom, meta: DraftBoardMeta, needs: CategoryNeed[]): Scored[] {
  const svs = rows.map(seasonValue).sort((a, b) => b - a);
  const seatsLeft = Math.max(room.size, room.size * activeStarters(meta) - room.picks.length);
  const replacement = svs[Math.min(svs.length - 1, seatsLeft - 1)] ?? 0;
  const weight = new Map(needs.map((n) => [n.key, n.weight]));
  return rows.map((row) => {
    const sv = seasonValue(row);
    const vorp = sv - replacement;
    const injury = -Math.max(0, sv) * injuryShare(row.injury_status);
    let punts = 0;
    let fit = 0;
    const z = row.category_z;
    if (z && meta.value_kind === "cat_value") {
      const total = Object.values(z).reduce((a, b) => a + b, 0);
      const perZ = total > 0 ? sv / total : 0;
      for (const key of room.punts) punts -= Math.max(0, z[key] ?? 0) * perZ * 0.5;
      // A nudge, not a second valuation: need tilts the order, value still leads it.
      for (const [key, value] of Object.entries(z)) fit += ((weight.get(key) ?? 1) - 1) * value * perZ * 0.25;
    }
    return { row, sv, vorp, injury, punts, fit, score: vorp + injury + punts };
  });
}

function recommendation(s: Scored, meta: DraftBoardMeta, room: DemoRoom): DraftRecommendation {
  const cats = meta.value_kind === "cat_value";
  const c = (key: RecommendationComponent["key"], label: string, value: number, in_score: boolean, detail: string) => ({
    key,
    label,
    value: round(value),
    in_score,
    detail,
  });
  const components: RecommendationComponent[] = [
    c("season_value", "Season value", s.sv, false, `${(s.row.value ?? 0).toFixed(1)} per game over a projected season`),
    c("vorp", "Value over replacement", s.vorp, true, `over the last starter still to be filled in a ${room.size}-team league`),
    ...(cats
      ? [c("punts", "Punted categories", s.punts, true, room.punts.length ? `conceding ${room.punts.join(", ")}` : "nothing punted — every category counts")]
      : []),
    c("injury", "Injury risk", s.injury, true, s.row.injury_status ? `listed ${s.row.injury_status.toLowerCase().replace(/_/g, " ")}` : "no injury flag"),
    c("congestion", "Lineup congestion", 0, true, "fits the lineup every game night"),
    ...(cats ? [c("category_fit", "Category fit", s.fit, false, s.fit > 1 ? "fills what your roster is behind in" : s.fit < -1 ? "adds where you are already ahead" : "balanced: no category need pulls this pick either way")] : []),
  ];
  const espn = s.row.market_rank != null ? `ESPN has him #${s.row.market_rank}` : "ESPN does not rank him";
  return {
    player_id: s.row.player_id,
    name: s.row.name,
    primary_position: s.row.primary_position,
    value: s.row.value ?? 0,
    season_value: round(s.sv),
    vorp: round(s.vorp),
    score: round(s.score),
    source: "cv",
    market_rank: s.row.market_rank,
    cv_rank: s.row.cv_rank,
    components,
    reason: `${s.row.name}: ${s.vorp >= 0 ? "+" : ""}${s.vorp.toFixed(1)} over replacement; ${espn}`,
  };
}

/** Where the market expects a player to go against the pick the caller waits for. */
function availability(row: DraftBoardRow, horizon: number | null, size: number): DraftBoardRow["availability"] {
  if (row.adp == null || horizon == null) return null;
  const margin = row.adp - horizon;
  if (margin < -size * 0.2) return "gone";
  if (margin < size * 0.35) return "tossup";
  return "likely";
}

export function demoBoard(room: DemoRoom, fixture: DemoFixture, source: BoardSource): DraftBoardResult {
  const taken = new Set(room.picks.map((p) => p.playerId));
  const byId = rowsById(fixture);
  const meta0 = fixture.meta;
  const { needs, seatsDrafted } = categoryNeed(room, fixture);
  const remaining = fixture.rows.filter((r) => !taken.has(r.player_id));
  const scored = score(remaining, room, meta0, needs);
  const byScore = [...scored].sort((a, b) => b.score - a.score);
  const roomRank = new Map(byScore.map((s, i) => [s.row.player_id, i + 1]));
  const cats = meta0.value_kind === "cat_value";
  const byFit = cats ? [...scored].sort((a, b) => b.sv + b.fit - (a.sv + a.fit)) : [];
  const fitRank = new Map(byFit.map((s, i) => [s.row.player_id, i + 1]));
  const fitValue = new Map(scored.map((s) => [s.row.player_id, s.row.value != null && s.sv > 0 ? s.row.value * (1 + s.fit / s.sv) : null]));

  // The pick the caller waits for: the next turn, or the one after when on the clock.
  const next = myNextPick(room);
  const following = next != null ? nextAfter(room, next) : null;
  const horizon = next != null && next === front(room) ? following : next;

  const rows = remaining.map((row) => ({
    ...row,
    board_rank: source === "cv" ? row.cv_rank : source === "my_team" ? roomRank.get(row.player_id) ?? null : row.board_rank,
    room_rank: roomRank.get(row.player_id) ?? null,
    room_score: round(scored.find((s) => s.row.player_id === row.player_id)?.score ?? 0),
    fit_rank: cats ? fitRank.get(row.player_id) ?? null : null,
    fit_value: cats ? (fitValue.get(row.player_id) != null ? round(fitValue.get(row.player_id)!, 2) : null) : null,
    availability: availability(row, horizon, room.size),
  }));
  const roster: DraftRosterEntry[] = room.picks
    .filter((p) => p.byMe)
    .sort((a, b) => a.overall - b.overall)
    .flatMap((p) => {
      const r = byId.get(p.playerId);
      return r
        ? [{ player_id: r.player_id, name: r.name, team: r.team, primary_position: r.primary_position, positions: r.positions, value: r.value, value_source: r.value_source, injury_status: r.injury_status }]
        : [];
    });
  const meta: DraftBoardMeta = {
    ...meta0,
    session_id: room.id,
    league_size: room.size,
    available: rows.length,
    rank_basis: source,
    rank_basis_requested: source,
    rank_basis_reason: source === "espn" ? "league_less_room" : source === "cv" ? "caller_chose_cv" : "caller_chose_my_team",
    punts: room.punts,
    category_need: needs,
    seats_drafted: seatsDrafted,
    pace_source: cats ? (seatsDrafted >= 3 ? "seats" : "tier") : null,
  };
  return {
    rows,
    recommendations: room.status === "active" ? byScore.slice(0, 5).map((s) => recommendation(s, meta, room)) : [],
    roster,
    meta,
    message: "",
  };
}

function nextAfter(room: DemoRoom, overall: number): number | null {
  if (room.mySlot == null) return null;
  const used = new Set(room.picks.map((p) => p.overall));
  for (let n = overall + 1; n <= total(room); n++) if (!used.has(n) && seatOf(room, n) === room.mySlot) return n;
  return null;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export class DemoRefusal extends Error {}

function resolvePlayer(fixture: DemoFixture, body: Pick<DraftPickCreate, "player_id" | "espn_player_id" | "player_name">): DraftBoardRow | null {
  const rows = fixture.rows;
  if (body.player_id != null) return rows.find((r) => r.player_id === body.player_id) ?? null;
  if (body.espn_player_id != null) return rows.find((r) => r.espn_id === body.espn_player_id) ?? null;
  const name = (body.player_name ?? "").trim().toLowerCase();
  return name ? rows.find((r) => r.name.toLowerCase() === name) ?? null : null;
}

function finish(room: DemoRoom, now: number): DemoRoom {
  const done = room.picks.length >= total(room);
  return { ...room, status: done ? "completed" : room.status, updatedAt: now };
}

export function demoPick(room: DemoRoom, fixture: DemoFixture, body: DraftPickCreate, now = Date.now()): { room: DemoRoom; overall: number } {
  if (room.status !== "active") throw new DemoRefusal(`This draft is ${room.status}`);
  const row = resolvePlayer(fixture, body);
  if (!row) throw new DemoRefusal("That player is not in this pool");
  if (room.picks.some((p) => p.playerId === row.player_id)) throw new DemoRefusal(`${row.name} is already drafted`);
  const overall = body.overall_pick ?? front(room);
  if (overall < 1 || overall > total(room)) throw new DemoRefusal(`Pick ${overall} is outside this draft`);
  if (room.picks.some((p) => p.overall === overall)) throw new DemoRefusal(`Pick ${overall} is already made`);
  const source: DemoPick["source"] = body.source === "keeper" ? "keeper" : "manual";
  const next = { ...room, picks: [...room.picks, { overall, playerId: row.player_id, byMe: body.by_me ?? false, source }] };
  return { room: finish(next, now), overall };
}

export function demoUndo(room: DemoRoom, overall: number, now = Date.now()): DemoRoom {
  if (!room.picks.some((p) => p.overall === overall)) throw new DemoRefusal(`Pick ${overall} is not recorded`);
  return { ...room, picks: room.picks.filter((p) => p.overall !== overall), status: "active", updatedAt: now };
}

/** A deterministic 0..1 from a pick number, so a re-run picks the same way. */
function noise(n: number, salt: number): number {
  const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** The autopicker: other seats draft by ADP with a little spread; under `end` your seat takes the top call. */
export function demoAdvance(room: DemoRoom, fixture: DemoFixture, until: NonNullable<MockUntil>, now = Date.now()): { room: DemoRoom; result: MockAdvance } {
  if (room.status !== "active") throw new DemoRefusal(`This draft is ${room.status}`);
  if (until === "my_turn" && room.mySlot == null) throw new DemoRefusal("This room has no seat of yours to stop at — set your slot, or simulate to the end");
  const start = front(room);
  let current = room;
  let made = 0;
  let stoppedAt: number | null = null;
  let reason: MockAdvance["stopped_reason"] = "end";
  for (;;) {
    const n = front(current);
    if (n > total(current)) break;
    const seat = seatOf(current, n);
    const mine = seat === current.mySlot;
    if (mine && until === "my_turn") {
      stoppedAt = n;
      reason = "my_turn";
      break;
    }
    const taken = new Set(current.picks.map((p) => p.playerId));
    const pool = fixture.rows.filter((r) => !taken.has(r.player_id));
    if (!pool.length) {
      stoppedAt = n;
      reason = "pool_exhausted";
      break;
    }
    let choice: DraftBoardRow;
    if (mine) {
      const call = demoBoard(current, fixture, "espn").recommendations[0];
      choice = (call && pool.find((r) => r.player_id === call.player_id)) || pool[0];
    } else {
      const byAdp = [...pool].sort((a, b) => (a.adp ?? (a.cv_rank ?? 400) + 40) - (b.adp ?? (b.cv_rank ?? 400) + 40));
      const r = noise(n, current.id);
      const index = r < 0.55 ? 0 : r < 0.8 ? 1 : r < 0.92 ? 2 : 3;
      choice = byAdp[Math.min(index, byAdp.length - 1)];
    }
    current = { ...current, picks: [...current.picks, { overall: n, playerId: choice.player_id, byMe: mine, source: "mock" }] };
    made += 1;
  }
  current = finish(current, now);
  const result: MockAdvance = {
    session: demoSession(current, fixture),
    picks_made: made,
    until,
    from_pick: start,
    stopped_at: stoppedAt,
    stopped_reason: reason,
    completed: current.status === "completed",
    fallback: false,
    market_as_of: fixture.meta.market_as_of,
  };
  return { room: current, result };
}

// ---------------------------------------------------------------------------
// Recap
// ---------------------------------------------------------------------------

// Relative letters, as the server grades: the room's best seats an A, its worst an F.
const GRADES = ["A", "B", "C", "D", "F"];

export function demoRecap(room: DemoRoom, fixture: DemoFixture): DraftRecapResult {
  const byId = rowsById(fixture);
  const byCv = new Map(fixture.rows.filter((r) => r.cv_rank != null).map((r) => [r.cv_rank!, r]));
  const byMarket = new Map(fixture.rows.filter((r) => r.market_rank != null).map((r) => [r.market_rank!, r]));
  const meta0 = fixture.meta;
  const cats = meta0.value_kind === "cat_value";

  const picks: RecapPick[] = [...room.picks]
    .sort((a, b) => a.overall - b.overall)
    .map((p) => {
      const r = byId.get(p.playerId)!;
      const geo = snakeSeat(p.overall, room.size);
      const slotRow = byCv.get(p.overall);
      const marketSlot = byMarket.get(p.overall);
      return {
        overall_pick: p.overall,
        round: geo.round,
        slot: geo.seat,
        by_me: p.byMe,
        source: p.source,
        player_id: r.player_id,
        espn_player_id: r.espn_id,
        player_name: r.name,
        team: r.team,
        value: r.value,
        cv_rank: r.cv_rank,
        market_rank: r.market_rank,
        adp: r.adp,
        surplus_cv: r.cv_rank != null ? r.cv_rank - p.overall : null,
        surplus_market: r.adp != null ? round(r.adp - p.overall) : null,
        surplus_espn: r.market_rank != null ? r.market_rank - p.overall : null,
        value_over_slot: r.value != null && slotRow?.value != null ? round(r.value - slotRow.value, 2) : null,
        market_value: r.auction_value,
        market_value_over_slot:
          r.auction_value != null && marketSlot?.auction_value != null ? round(r.auction_value - marketSlot.auction_value) : null,
        market_value_over_bid: null,
        bid: null,
      };
    });

  const seats: RecapSeat[] = Array.from({ length: room.size }, (_, i) => i + 1).map((slot) => {
    const mine = picks.filter((p) => p.slot === slot);
    const sum = (f: (p: RecapPick) => number | null) => {
      const vals = mine.map(f).filter((v): v is number => v != null);
      return vals.length ? round(vals.reduce((a, b) => a + b, 0)) : null;
    };
    const graded = mine.filter((p) => p.market_value_over_slot != null);
    const best = graded.reduce<RecapPick | null>((b, p) => (!b || p.market_value_over_slot! > b.market_value_over_slot! ? p : b), null);
    const worst = graded.reduce<RecapPick | null>((w, p) => (!w || p.market_value_over_slot! < w.market_value_over_slot! ? p : w), null);
    return {
      slot,
      espn_team_id: null,
      is_me: slot === room.mySlot,
      picks: mine.length,
      unscored: mine.filter((p) => p.value == null).length,
      total_value: round(mine.reduce((a, p) => a + (p.value ?? 0), 0)),
      value_over_slot: sum((p) => p.value_over_slot),
      market_value_over_slot: sum((p) => p.market_value_over_slot),
      market_value_over_bid: null,
      unpriced: mine.filter((p) => p.market_value == null).length,
      grade: null,
      position: null,
      best_pick: best?.overall_pick ?? null,
      worst_pick: worst?.overall_pick ?? null,
    };
  });
  const order = [...seats].sort((a, b) => (b.market_value_over_slot ?? -1e9) - (a.market_value_over_slot ?? -1e9));
  order.forEach((s, i) => {
    s.position = i + 1;
    const f = seats.length > 1 ? i / (seats.length - 1) : 0;
    s.grade = s.picks ? GRADES[Math.min(GRADES.length - 1, Math.round(f * (GRADES.length - 1)))] : null;
  });

  const defs = meta0.categories ?? [];
  const keys = defs.map((d) => d.key);
  const sums = cats ? seatSums(room, fixture, keys, null) : new Map<number, Record<string, number>>();
  const seasonBySeat = new Map<number, number>();
  for (const p of room.picks) {
    const r = byId.get(p.playerId);
    if (r) seasonBySeat.set(seatOf(room, p.overall), (seasonBySeat.get(seatOf(room, p.overall)) ?? 0) + seasonValue(r));
  }
  const slots = seats.map((s) => s.slot);
  const valueOrder = [...slots].sort((a, b) => (seasonBySeat.get(b) ?? 0) - (seasonBySeat.get(a) ?? 0));
  const catRank = (slot: number, key: string) => {
    const mine = sums.get(slot)?.[key] ?? 0;
    return 1 + slots.filter((o) => (sums.get(o)?.[key] ?? 0) > mine).length;
  };
  const roto = new Map(slots.map((slot) => [slot, keys.reduce((a, key) => a + (room.size - catRank(slot, key) + 1), 0)]));
  const rotoOrder = [...slots].sort((a, b) => roto.get(b)! - roto.get(a)!);
  const standings: RecapStanding[] = slots.map((slot) => {
    const h2h = cats
      ? slots
          .filter((o) => o !== slot)
          .map((o) => {
            let won = 0;
            let lost = 0;
            let tied = 0;
            for (const def of defs) {
              const a = sums.get(slot)?.[def.key] ?? 0;
              const b = sums.get(o)?.[def.key] ?? 0;
              const better = def.higher_is_better ? a - b : b - a;
              if (Math.abs(better) < 1e-9) tied++;
              else if (better > 0) won++;
              else lost++;
            }
            return { opponent_slot: o, won, lost, tied };
          })
      : [];
    return {
      slot,
      categories: cats
        ? defs.map((def) => ({
            key: def.key,
            label: def.label,
            z_sum: round(sums.get(slot)?.[def.key] ?? 0, 2),
            rank: catRank(slot, def.key),
            roto_points: room.size - catRank(slot, def.key) + 1,
          }))
        : [],
      roto_points: cats ? roto.get(slot)! : null,
      roto_rank: cats ? rotoOrder.indexOf(slot) + 1 : null,
      season_value: cats ? null : round(seasonBySeat.get(slot) ?? 0),
      value_rank: valueOrder.indexOf(slot) + 1,
      expected_wins: cats && h2h.length ? round(h2h.reduce((a, c) => a + c.won + c.tied / 2, 0) / h2h.length, 2) : null,
      h2h,
    };
  });

  return {
    picks,
    seats,
    standings,
    meta: {
      format: meta0.format,
      value_kind: meta0.value_kind,
      graded_by: "market_value_over_slot",
      grade_basis: "espn",
      grade_basis_reason: "league_less_room",
      market_rank_type: meta0.market_rank_type,
      standings_basis: cats ? "z_sum" : "season_value",
      session_id: room.id,
      status: room.status,
      complete: room.picks.length >= total(room),
      picks_made: room.picks.length,
      total_picks: total(room),
      unscored: picks.filter((p) => p.value == null).length,
      unattributed: 0,
      league_size: room.size,
      rounds: room.rounds,
      my_slot: room.mySlot,
      draft_type: "snake",
      categories: defs,
      projections_as_of: meta0.projections_as_of,
      market_as_of: meta0.market_as_of,
    },
    message: picks.length ? "" : "No picks yet: draft first, then read the recap.",
  };
}
