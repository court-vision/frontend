import { describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { teamsKeys } from "@/hooks/useTeams";
import { overviewKeys } from "@/hooks/useTeamsOverview";
import { insetOf } from "../desk-zoom";
import {
  benchPlaying,
  chanceText,
  duelOf,
  edgeColor,
  edgeOf,
  latestCheckins,
  leadItem,
  moreItems,
  nextNeeding,
  overviewPollMs,
  rowHead,
  seatParts,
  seatsPlaying,
  seatsTotal,
  tapeOf,
  tipsAfterLock,
  todayOf,
  untilText,
  weekCells,
} from "../home";
import { HOME_DEMO, HOME_DEMO_NOW, HOME_DEMO_SLATE, demoLiveMatchup } from "../home-demo";
import type { AiCheckin } from "@/types/ai";
import type { OverviewDay, OverviewItem, TeamOverview, TeamsOverviewData } from "@/types/team-overview";

const MIN = 60_000;
const team = (id: number): TeamOverview => HOME_DEMO.teams.find((t) => t.team_id === id)!;
const NEEDS_YOU = team(25); // needs you: a starter is out, with a deadline, and one idea more
const YOUR_CALL = team(21); // your call, a categories league
const ALL_SET = team(23); // set
const AUTOPILOT = team(30); // autopilot

const item = (standing: OverviewItem["standing"], title: string, deadline: string | null = null, coveredBy: OverviewItem["covered_by"] = null): OverviewItem =>
  ({ ...NEEDS_YOU.items[0], standing, covered_by: coveredBy, deadline_at: deadline, action: { ...NEEDS_YOU.items[0].action, id: title, title, detail: `${title} detail` } }) as OverviewItem;

describe("untilText", () => {
  test("counts down in minutes, then hours and minutes", () => {
    expect(untilText(48 * MIN + 20_000)).toBe("in 48 min");
    expect(untilText(125 * MIN)).toBe("in 2 h 5 min");
    expect(untilText(120 * MIN)).toBe("in 2 h");
  });
  test("is now inside the last minute and nothing once it has passed", () => {
    expect(untilText(30_000)).toBe("now");
    expect(untilText(-1)).toBeNull();
  });
});

describe("what a row leads with", () => {
  test("the move that needs the user comes before an idea, whatever the order", () => {
    const t = { ...NEEDS_YOU, items: [item("covered", "covered", null, "auto_lineup"), item("your_call", "idea"), item("needs_you", "needed")] };
    expect(leadItem(t)?.action.title).toBe("needed");
    expect(moreItems(t)).toBe(1);
  });
  test("a covered move leads only when nothing is open, and counts no more", () => {
    const t = { ...ALL_SET, items: [item("covered", "Start Mara for Irving", null, "late_scratch")] };
    const head = rowHead(t);
    expect(head.say).toBe("Start Mara for Irving");
    expect(head.detail).toBe("The late-scratch swap is set to make this move.");
    expect(head.coveredBy).toBe("late_scratch");
    expect(moreItems(t)).toBe(0);
  });
  test("the lead move carries its copy and its deadline", () => {
    const head = rowHead(NEEDS_YOU);
    expect(head.say).toBe(NEEDS_YOU.items[0].action.title);
    expect(head.deadlineAt).toBe(Date.parse(NEEDS_YOU.items[0].deadline_at!));
    expect(moreItems(NEEDS_YOU)).toBe(NEEDS_YOU.items.filter((i) => i.standing !== "covered").length - 1);
  });
  test("a team with nothing to do says how its lineup stands", () => {
    expect(rowHead(ALL_SET).say).toBe("Lineup is set. 10 of 10 starters play tonight.");
    expect(rowHead(AUTOPILOT).say).toStartWith("Dime is driving. Lineup is set.");
    const idle = { ...ALL_SET, tonight: { ...ALL_SET.tonight!, counts: { idle: 10 } } };
    expect(rowHead(idle).say).toBe("No games tonight.");
  });
  test("a team that can't be read says why and what to do", () => {
    const t = { ...ALL_SET, state: "cant_read", error: { code: "PROVIDER_AUTH_EXPIRED", message: "ESPN would not let us in." }, items: [], tonight: null } as TeamOverview;
    const head = rowHead(t);
    expect(head.say).toBe("ESPN would not let us in.");
    expect(head.detail).toContain("reconnect it in Account");
    expect(rowHead({ ...t, error: null }).say).toBe("This team's board could not be read.");
  });
});

describe("tonight's seats", () => {
  test("playing counts every seat with a game, and the words keep the board's order", () => {
    const counts = { live: 3, final: 2, later: 4, questionable: 1, out: 1, idle: 2, empty: 1 };
    expect(seatsPlaying(counts)).toBe(10);
    expect(seatsTotal(counts)).toBe(14);
    expect(seatParts(counts).map((p) => `${p.n} ${p.word}`)).toEqual(["3 live", "2 final", "4 to come", "1 Q", "1 out", "1 empty"]);
    expect(seatParts(counts).find((p) => p.word === "out")?.tone).toBe("down");
    expect(seatParts({ idle: 10 })).toEqual([]);
    expect(seatsPlaying(null)).toBe(0);
  });
});

describe("the week strip", () => {
  const day = (kind: OverviewDay["kind"], you: number | null, opp: number | null, yg = 5, og = 5): OverviewDay => ({
    date: `2026-11-1${kind === "past" ? 6 : kind === "today" ? 7 : 8}`, kind, your_points: you, opponent_points: opp, your_games: yg, opponent_games: og, estimated: false,
  });
  test("a day played shows its margin with a real minus", () => {
    const [won, lost, level] = weekCells([day("past", 214, 198.4), day("past", 150, 187), day("today", 40, 40)]);
    expect([won.text, won.tone]).toEqual(["+16", "up"]);
    expect([lost.text, lost.tone]).toEqual(["−37", "down"]);
    expect([level.text, level.tone]).toEqual(["0", null]);
  });
  test("a day ahead shows the games each side has, flagged when theirs outnumber yours by two", () => {
    const [more, fewer, close] = weekCells([day("future", null, null, 8, 5), day("future", null, null, 5, 8), day("future", null, null, 5, 6)]);
    expect([more.text, more.tone]).toEqual(["8v5", "hi"]);
    expect([fewer.text, fewer.tone]).toEqual(["5v8", "lo"]);
    expect([close.text, close.tone]).toEqual(["5v6", null]);
  });
  test("a categories league has no day margins: every day shows games", () => {
    expect(weekCells(YOUR_CALL.week).every((c) => /^\d+v\d+$/.test(c.text))).toBe(true);
  });
  test("today is found, and an empty week is empty", () => {
    expect(todayOf(NEEDS_YOU.week)?.kind).toBe("today");
    expect(todayOf([])).toBeNull();
    expect(weekCells(null)).toEqual([]);
  });
});

describe("a row's edge", () => {
  test("is yellow at a coin flip and leans green or red with the chance to win the week", () => {
    expect(edgeOf(0.5)).toEqual({ tone: "up", lean: 0 });
    expect(edgeOf(0.65)).toEqual({ tone: "up", lean: 50 });
    expect(edgeOf(0.35)).toEqual({ tone: "down", lean: 50 });
    expect(edgeColor(edgeOf(0.35))).toBe("color-mix(in oklab, var(--down) 50%, var(--warn))");
  });
  test("is one colour once the week is one-sided, and stays inside 0 to 1", () => {
    expect(edgeOf(0.8)).toEqual({ tone: "up", lean: 100 });
    expect(edgeOf(0.99)).toEqual(edgeOf(0.8));
    expect(edgeOf(0.01)).toEqual({ tone: "down", lean: 100 });
    expect(edgeOf(1.4)).toEqual({ tone: "up", lean: 100 });
    expect(edgeOf(-1)).toEqual({ tone: "down", lean: 100 });
  });
  test("a team with no chance to go on has no edge and nothing read aloud", () => {
    expect(edgeOf(null)).toBeNull();
    expect(edgeOf(undefined)).toBeNull();
    expect(edgeOf(Number.NaN)).toBeNull();
    expect(edgeColor(null)).toBeUndefined();
    expect(chanceText(null)).toBe("");
    expect(chanceText(0.536)).toBe("54% to win the week");
  });
  test("every demo team has a chance, and both ends of the spectrum are on show", () => {
    const leans = HOME_DEMO.teams.map((t) => edgeOf(t.matchup?.win_chance));
    expect(leans.every((e) => e !== null)).toBe(true);
    expect(new Set(leans.map((e) => e!.tone))).toEqual(new Set(["up", "down"]));
    expect(leans.some((e) => e!.lean < 40)).toBe(true);
  });
});

describe("the strip above the rows", () => {
  const tape = tapeOf(HOME_DEMO, HOME_DEMO_NOW);
  test("counts what stands across the teams", () => {
    expect(tape.needs).toBe(1);
    expect(tape.calls).toBe(2);
    expect(tape.quiet).toBe(3);
    expect(tape.cantRead).toBe(0);
    expect(tape.ahead + tape.behind + tape.level).toBe(5);
    expect(tape.leagues).toBe(HOME_DEMO.teams.filter((t) => t.season).length);
  });
  test("the next lock is the soonest tip still ahead, with the starters it locks", () => {
    const locks = HOME_DEMO.teams.map((t) => Date.parse(t.tonight!.next_lock_at!)).filter((ms) => ms > HOME_DEMO_NOW);
    expect(tape.nextLockAt).toBe(Math.min(...locks));
    expect(tape.lockSeats).toBeGreaterThan(0);
    // Once every lock has passed there is none
    expect(tapeOf(HOME_DEMO, HOME_DEMO_NOW + 24 * 60 * MIN).nextLockAt).toBeNull();
  });
  test("a lock that has passed since the read does not mean every game has tipped", () => {
    const tonight = NEEDS_YOU.tonight!;
    const lock = Date.parse(tonight.next_lock_at!);
    const later = tonight.seats.filter((s) => (s.mark === "later" || s.mark === "questionable") && s.game_time_et !== tonight.next_lock_et);
    // The demo's team has starters tipping after its next lock
    expect(later.length).toBeGreaterThan(0);
    expect(tipsAfterLock(tonight, lock - MIN)).toBe(false);
    expect(tipsAfterLock(tonight, lock + MIN)).toBe(true);
    expect(tapeOf(HOME_DEMO, HOME_DEMO_NOW).lockPending).toBe(false);
    expect(tapeOf({ ...HOME_DEMO, teams: [NEEDS_YOU] }, lock + MIN)).toMatchObject({ nextLockAt: null, lockPending: true });
    // With every starter left tipping at that lock, all of them have tipped once it passes
    const atOnce = { ...tonight, seats: tonight.seats.filter((s) => !later.includes(s)) };
    expect(tipsAfterLock(atOnce, lock + MIN)).toBe(false);
    expect(tipsAfterLock(null, lock)).toBe(false);
  });
  test("a starter whose game has no tip time yet is still to tip", () => {
    const tonight = NEEDS_YOU.tonight!;
    const lock = Date.parse(tonight.next_lock_at!);
    const toCome = (s: (typeof tonight.seats)[number]) => s.mark === "later" || s.mark === "questionable";
    // One starter's game has no start time: the server marks him to come and sets no lock for him
    const first = tonight.seats.find((s) => toCome(s) && s.game_time_et === tonight.next_lock_et)!;
    const untimed = { ...first, game_time_et: null };
    const atLock = tonight.seats.filter((s) => !toCome(s) || s.game_time_et === tonight.next_lock_et);
    const withUntimed = { ...tonight, seats: atLock.map((s) => (s === first ? untimed : s)) };
    expect(tipsAfterLock({ ...tonight, seats: atLock }, lock + MIN)).toBe(false);
    expect(tipsAfterLock(withUntimed, lock - MIN)).toBe(false);
    expect(tipsAfterLock(withUntimed, lock + MIN)).toBe(true);
    // He is the only one left to come, so the read has no lock at all
    const noLock = { ...tonight, next_lock_at: null, next_lock_et: null, seats: tonight.seats.map((s) => (s === first ? untimed : toCome(s) ? { ...s, mark: "final" as const } : s)) };
    expect(tipsAfterLock(noLock, lock)).toBe(true);
    expect(tapeOf({ ...HOME_DEMO, teams: [{ ...NEEDS_YOU, tonight: noLock }] }, lock)).toMatchObject({ nextLockAt: null, lockPending: true });
    // No lock and nobody to come: every game has tipped
    expect(tipsAfterLock({ ...noLock, seats: noLock.seats.filter((s) => s !== untimed) }, lock)).toBe(false);
  });
  test("seats add up across the teams", () => {
    const total = HOME_DEMO.teams.reduce((a, t) => a + seatsTotal(t.tonight?.counts), 0);
    expect(tape.seats.total).toBe(total);
    expect(tape.seats.live + tape.seats.toCome + tape.seats.final).toBe(tape.seats.playing);
  });
});

describe("when the overview is read again", () => {
  const quiet: TeamsOverviewData = {
    ...HOME_DEMO,
    next_deadline_at: null,
    teams: HOME_DEMO.teams.map((t) => ({ ...t, tonight: { ...t.tonight!, counts: { idle: 10 }, next_lock_at: null } })),
  };
  test("every five minutes when nothing is on or near", () => {
    expect(overviewPollMs(quiet, HOME_DEMO_NOW)).toBe(5 * MIN);
    expect(overviewPollMs(undefined, HOME_DEMO_NOW)).toBe(5 * MIN);
  });
  test("every 90 seconds while a starter is live, or a lock or deadline is within the hour", () => {
    expect(overviewPollMs(HOME_DEMO, HOME_DEMO_NOW)).toBe(90_000);
    const lockSoon = { ...quiet, teams: [{ ...quiet.teams[0], tonight: { ...quiet.teams[0].tonight!, next_lock_at: new Date(HOME_DEMO_NOW + 40 * MIN).toISOString() } }] };
    expect(overviewPollMs(lockSoon, HOME_DEMO_NOW)).toBe(90_000);
    const lockLater = { ...quiet, teams: [{ ...quiet.teams[0], tonight: { ...quiet.teams[0].tonight!, next_lock_at: new Date(HOME_DEMO_NOW + 3 * 60 * MIN).toISOString() } }] };
    expect(overviewPollMs(lockLater, HOME_DEMO_NOW)).toBe(5 * MIN);
    expect(overviewPollMs({ ...quiet, next_deadline_at: new Date(HOME_DEMO_NOW + 10 * MIN).toISOString() }, HOME_DEMO_NOW)).toBe(90_000);
  });
  test("after 30 seconds while a league is still being projected", () => {
    const pending = { ...quiet, teams: [{ ...quiet.teams[0], season: null, season_state: "pending" as const }] };
    expect(overviewPollMs(pending, HOME_DEMO_NOW)).toBe(30_000);
  });
});

describe("tonight's matchup, seat against seat", () => {
  const live = demoLiveMatchup(25)!;
  const duel = duelOf(NEEDS_YOU, live, HOME_DEMO_SLATE)!;
  test("pairs each of your seats with theirs in the same slot, in the board's order", () => {
    expect(duel.rows.map((r) => r.slot)).toEqual(NEEDS_YOU.tonight!.seats.map((s) => s.slot));
    expect(duel.rows.every((r) => r.you != null)).toBe(true);
    // Their starter by row: the repeated slot (UT) takes them in the order their roster lists them
    expect(duel.rows.map((r) => r.opp?.name ?? null)).toEqual([
      "Cade Cunningham", "Devin Booker", "Franz Wagner", "Evan Mobley", "Alperen Sengun",
      "Jalen Brunson", "Jalen Johnson", "Deni Avdija", "Cam Thomas", "Brandon Miller",
    ]);
  });
  test("sums each side and counts the bench that still plays", () => {
    expect(duel.you.points).toBe(NEEDS_YOU.tonight!.points!);
    const theirs = duel.rows.reduce((a, r) => a + (r.opp?.points ?? 0), 0);
    expect(duel.opp?.points).toBe(theirs);
    expect(todayOf(NEEDS_YOU.week)?.opponent_points).toBe(theirs);
    expect(benchPlaying(duel.bench.you).length).toBeLessThanOrEqual(duel.bench.you.length);
  });
  test("an out starter of yours stays out; one of theirs with no game is idle", () => {
    expect(duel.rows.some((r) => r.you?.mark === "out")).toBe(true);
    const noGame = { ...live.opponent_team.roster[0], team: "XXX", live: null };
    const d = duelOf(NEEDS_YOU, { ...live, opponent_team: { ...live.opponent_team, roster: [noGame, ...live.opponent_team.roster.slice(1)] } }, HOME_DEMO_SLATE)!;
    expect(d.rows.find((r) => r.opp?.name === noGame.name)?.opp?.mark).toBe("idle");
  });
  test("one of theirs with no line in a game that is on or over is not still to come", () => {
    const p = live.opponent_team.roster.find((r) => r.live == null && HOME_DEMO_SLATE.games.some((g) => g.status === "scheduled" && (g.home_team === r.team || g.away_team === r.team)))!;
    const markOn = (status: string) => {
      const slate = { ...HOME_DEMO_SLATE, games: HOME_DEMO_SLATE.games.map((g) => (g.home_team === p.team || g.away_team === p.team ? { ...g, status } : g)) };
      const cells = duelOf(NEEDS_YOU, live, slate)!;
      return [...cells.rows.map((r) => r.opp), ...cells.bench.opp].find((c) => c?.name === p.name)!;
    };
    expect(markOn("scheduled")).toMatchObject({ mark: "later", points: null });
    expect(markOn("scheduled").tipEt).not.toBeNull();
    expect(markOn("in_progress")).toEqual({ name: p.name, mark: "live", points: null, tipEt: null });
    expect(markOn("final")).toEqual({ name: p.name, mark: "final", points: null, tipEt: null });
  });
  test("box scores read for another NBA date are not tonight's", () => {
    // From the 3 AM ET rollover until the post-game run, the live read is still last night's
    const stale = duelOf(NEEDS_YOU, { ...live, game_date: "2026-11-18" }, HOME_DEMO_SLATE)!;
    expect(duel.opp!.points).toBeGreaterThan(0);
    expect(stale.opp!.points).toBe(0);
    // Their lineup still stands, slot for slot
    expect(stale.rows.map((r) => r.opp?.name)).toEqual(duel.rows.map((r) => r.opp?.name));
    expect(stale.rows.every((r) => r.opp == null || r.opp.points == null)).toBe(true);
  });
  test("without the opponent's roster the rows carry your side alone", () => {
    const alone = duelOf(NEEDS_YOU, null, HOME_DEMO_SLATE)!;
    expect(alone.opp).toBeNull();
    expect(alone.rows.every((r) => r.opp == null)).toBe(true);
    expect(alone.rows.length).toBe(NEEDS_YOU.tonight!.seats.length);
  });
  test("a starter of theirs in a slot yours has no seat for is still shown and counted", () => {
    const extra = { ...live, opponent_team: { ...live.opponent_team, roster: [...live.opponent_team.roster, { ...live.opponent_team.roster[0], player_id: 9999, name: "Extra Guard", lineup_slot: "PG" }] } };
    const d = duelOf(NEEDS_YOU, extra, HOME_DEMO_SLATE)!;
    expect(d.rows.length).toBe(NEEDS_YOU.tonight!.seats.length + 1);
    expect(d.rows.at(-1)).toMatchObject({ slot: "PG", you: null });
  });
  test("a team whose tonight could not be read has no matchup to show", () => {
    expect(duelOf({ ...NEEDS_YOU, tonight: null }, live, HOME_DEMO_SLATE)).toBeNull();
  });
});

describe("moving to the next team that needs you", () => {
  test("wraps around and skips teams that need nothing", () => {
    const teams = HOME_DEMO.teams;
    const needs = teams.findIndex((t) => t.state === "needs_you");
    expect(nextNeeding(teams, teams.length - 1)).toBe(needs);
    expect(nextNeeding(teams, needs)).toBe(needs);
    expect(nextNeeding(teams.filter((t) => t.state !== "needs_you"), 0)).toBeNull();
  });
});

describe("Dime's last check-in on each team", () => {
  const checkin = (teamId: number, state: AiCheckin["state"], started: string, finished: string | null, title: string, conversation: number | null = 7): AiCheckin =>
    ({ team_id: teamId, state, started_at: started, finished_at: finished, title, conversation_id: conversation }) as AiCheckin;
  test("keeps the newest finished one per team and where it leads", () => {
    const lasts = latestCheckins([
      checkin(1, "done", "2026-11-19T10:00:00Z", "2026-11-19T10:01:00Z", "morning", 11),
      checkin(1, "done", "2026-11-19T22:00:00Z", "2026-11-19T22:02:00Z", "evening", 12),
      checkin(1, "running", "2026-11-19T23:00:00Z", null, "still going", 13),
      checkin(2, "failed", "2026-11-19T22:00:00Z", "2026-11-19T22:02:00Z", "failed", 14),
    ]);
    expect(lasts.get(1)).toEqual({ title: "evening", conversationId: 12, at: "2026-11-19T22:02:00Z" });
    expect(lasts.has(2)).toBe(false);
    expect(latestCheckins(null).size).toBe(0);
  });
  test("orders them as instants, whatever precision each was written in", () => {
    const whole = checkin(1, "done", "2026-11-19T22:00:00Z", "2026-11-19T22:00:00Z", "on the second", 21);
    const fraction = checkin(1, "done", "2026-11-19T22:00:00Z", "2026-11-19T22:00:00.500Z", "half a second later", 22);
    expect(latestCheckins([whole, fraction]).get(1)?.conversationId).toBe(22);
    expect(latestCheckins([fraction, whole]).get(1)?.conversationId).toBe(22);
  });
});

describe("the box a desk grows out of", () => {
  test("is the row's box as an inset of the viewport", () => {
    expect(insetOf({ top: 300, left: 860, right: 1092, bottom: 318 }, 1512, 900)).toBe("inset(300px 420px 582px 860px round 6px)");
  });
  test("never reaches outside the viewport", () => {
    expect(insetOf({ top: -20, left: 0, right: 1600, bottom: 950 }, 1512, 900)).toBe("inset(0px 0px 0px 0px round 6px)");
  });
});

describe("the overview's place among the queries", () => {
  test("whatever reads the team list again (a team added, removed or re-synced) reads the overview again", async () => {
    const client = new QueryClient();
    client.setQueryData(overviewKeys.mine("user_1"), HOME_DEMO);
    client.setQueryData(teamsKeys.detail(25), { team_id: 25 });
    await client.invalidateQueries({ queryKey: teamsKeys.lists() });
    expect(client.getQueryState(overviewKeys.mine("user_1"))?.isInvalidated).toBe(true);
    expect(client.getQueryState(teamsKeys.detail(25))?.isInvalidated).toBe(false);
    client.clear();
  });
  test("one account's overview is never another's", () => {
    expect(overviewKeys.mine("user_1")).not.toEqual(overviewKeys.mine("user_2"));
  });
});
