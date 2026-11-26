"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { DeskBar, DeskStatus } from "@/components/desk/DeskBar";
import { ACCOUNT, AI_DESK, HOME_DESK, WEEK_DESK } from "@/components/desk/routes";
import { useDeskTheme } from "@/components/desk/useDeskTheme";
import { useAiCheckinsQuery, useAiUsageQuery } from "@/hooks/useAi";
import { useGamesOnDateQuery } from "@/hooks/useGames";
import { useLiveMatchupQuery } from "@/hooks/useMatchup";
import { useTeamsOverviewQuery } from "@/hooks/useTeamsOverview";
import { useViewerZone } from "@/hooks/useViewerZone";
import { userMessage } from "@/lib/api-error";
import { zoomTo } from "@/lib/desk-zoom";
import { duelOf, latestCheckins, nextNeeding, type Duel, type LastCheckin } from "@/lib/home";
import { HOME_DEMO, HOME_DEMO_CHECKINS, HOME_DEMO_NOW, HOME_DEMO_SLATE, demoLiveMatchup } from "@/lib/home-demo";
import { localClock } from "@/lib/local-time";
import { useDimeAsk } from "@/stores/useDimeAsk";
import { useUIStore } from "@/stores/useUIStore";
import type { TeamOverview, TeamsOverviewData } from "@/types/team-overview";
import { Board, HomeTape, rowEl, weekEl } from "./Board";
import { TeamSide, type Doors } from "./TeamSide";
import dk from "@/components/desk/desk.module.css";
import s from "./home.module.css";

const KEYS: Array<[string, string]> = [
  ["↑↓", "team"],
  ["⏎", "open its Week"],
  ["D", "ask Dime"],
  ["N", "next that needs you"],
  ["T", "theme"],
];

/** Below this the picked team's page takes the screen in the rows' place (home.module.css). */
const NARROW = "(max-width: 1179.98px)";

const NO_TEAMS: TeamOverview[] = [];

// ---------------------------------------------------------------------------
// The desk's model: the live account, or the demo's sample teams
// ---------------------------------------------------------------------------

interface DuelRead {
  duel: Duel | null;
  /** The opponent's lineup is still being read. */
  loading: boolean;
}

interface HomeModel {
  demo: boolean;
  status: "signed-out" | "loading" | "error" | "ready";
  message: string | null;
  data: TeamsOverviewData | null;
  /** A read is under way behind what is shown. */
  fetching: boolean;
  /** The last read failed; what is shown is the one before it. */
  stale: boolean;
  refetch: () => void;
  now: number;
  /** Each team's last check-in by Dime. */
  lasts: Map<number, LastCheckin>;
  /** Dime answers on this account: the ask line asks it. */
  dime: boolean;
  /** The picked team's id: the team every desk is on. */
  picked: number | null;
  pick: (teamId: number) => void;
  /** Tonight's matchup for the picked team, seat against seat. */
  useDuel: (team: TeamOverview | null) => DuelRead;
}

function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}

/** The picked team's opponent comes from the Week desk's live matchup read, the tips from the day's slate. */
function useLiveDuel(team: TeamOverview | null): DuelRead {
  const live = useLiveMatchupQuery(team?.tonight && team.matchup ? team.team_id : null);
  const slate = useGamesOnDateQuery(team?.nba_date ?? "");
  const duel = useMemo(() => (team ? duelOf(team, live.data, slate.data) : null), [team, live.data, slate.data]);
  return { duel, loading: live.isLoading };
}

function useLiveHome(): HomeModel {
  const { isLoaded, isSignedIn } = useAuth();
  const overview = useTeamsOverviewQuery();
  const usage = useAiUsageQuery();
  const dime = usage.data?.access === true;
  const checkins = useAiCheckinsQuery(dime);
  const lasts = useMemo(() => latestCheckins(checkins.data?.checkins), [checkins.data]);
  const now = useNow(30_000);
  const selected = useUIStore((st) => st.selectedTeam);
  const pick = useUIStore((st) => st.setSelectedTeam);
  const { data, error, isFetching, refetch } = overview;
  const teams = data?.teams;
  const picked = teams?.length ? (teams.some((t) => t.team_id === selected) ? selected : teams[0].team_id) : null;
  return {
    demo: false,
    status: !isLoaded ? "loading" : !isSignedIn ? "signed-out" : data ? "ready" : error ? "error" : "loading",
    message: error ? userMessage(error, "Your teams could not be read.") : null,
    data: data ?? null,
    fetching: isFetching,
    stale: !!error && !!data,
    refetch: () => void refetch(),
    now,
    lasts,
    dime,
    picked,
    pick,
    useDuel: useLiveDuel,
  };
}

function useDemoDuel(team: TeamOverview | null): DuelRead {
  return useMemo(() => ({ duel: team ? duelOf(team, demoLiveMatchup(team.team_id), HOME_DEMO_SLATE) : null, loading: false }), [team]);
}

/** The demo's picked team, kept for the visit so coming back from a desk lands on the same row. */
let demoPicked: number | null = HOME_DEMO.teams[0]?.team_id ?? null;

function useDemoHome(): HomeModel {
  const [picked, setPicked] = useState<number | null>(() => demoPicked);
  const pick = useCallback((teamId: number) => {
    demoPicked = teamId;
    setPicked(teamId);
  }, []);
  return {
    demo: true,
    status: "ready",
    message: null,
    data: HOME_DEMO,
    fetching: false,
    stale: false,
    refetch: () => {},
    now: HOME_DEMO_NOW,
    lasts: HOME_DEMO_CHECKINS,
    dime: true,
    picked,
    pick,
    useDuel: useDemoDuel,
  };
}

// ---------------------------------------------------------------------------
// The desk
// ---------------------------------------------------------------------------

export function HomePage({ demo }: { demo: boolean }) {
  return demo ? <DemoHome /> : <LiveHome />;
}

function LiveHome() {
  return <HomeDesk model={useLiveHome()} />;
}

function DemoHome() {
  return <HomeDesk model={useDemoHome()} />;
}

function HomeDesk({ model }: { model: HomeModel }) {
  const router = useRouter();
  const tz = useViewerZone();
  const toggleTheme = useDeskTheme((st) => st.toggle);
  const [pane, setPane] = useState<"board" | "team">("board");
  const [hint, setHint] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const { demo, data, now, pick, picked } = model;
  const teams = data?.teams ?? NO_TEAMS;
  const team = teams.find((t) => t.team_id === picked) ?? null;
  const { duel, loading: duelLoading } = model.useDuel(team);

  // ---- the doors: a team's Week desk and its Dime. The team picked here is the team every desk is on

  const doors = useMemo<Doors>(
    () => ({
      week: (t, from) => {
        pick(t.team_id);
        zoomTo(from, () => router.push(demo ? `${WEEK_DESK}?demo` : WEEK_DESK));
      },
      dime: (t, from, conversationId) => {
        pick(t.team_id);
        zoomTo(from, () => router.push(demo ? `${AI_DESK}?demo` : conversationId ? `${AI_DESK}?c=${conversationId}` : AI_DESK));
      },
      hint: setHint,
    }),
    [demo, pick, router]
  );

  // ---- the team's page where it takes the screen: opening it is a step Back undoes

  useEffect(() => {
    const onPop = () => setPane(window.history.state?.homePane === "team" ? "team" : "board");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const back = useCallback(() => {
    if (window.history.state?.homePane === "team") window.history.back();
    else setPane("board");
  }, []);

  const onPick = useCallback(
    (t: TeamOverview, open: boolean) => {
      pick(t.team_id);
      // Beside the rows the page is already there; a click only picks
      if (!open || !window.matchMedia(NARROW).matches) return;
      setPane("team");
      if (window.history.state?.homePane !== "team") window.history.pushState({ ...window.history.state, homePane: "team" }, "");
    },
    [pick]
  );

  useEffect(() => {
    if (picked != null) rowEl(picked)?.scrollIntoView({ block: "nearest" });
  }, [picked]);

  // ---- the ask line: a question for Dime about the picked team, typed in the bar

  const closeAsk = useCallback(() => {
    setAsking(false);
    setQuestion("");
  }, []);

  const ask = useCallback(() => {
    if (!team) return;
    // Without Dime on the account there is nothing to ask: its desk says why
    if (model.dime) setAsking(true);
    else doors.dime(team, rowEl(team.team_id), null);
  }, [team, model.dime, doors]);

  const onAsk = (e: React.FormEvent) => {
    e.preventDefault();
    const text = question.trim();
    if (!text || !team) return;
    // The demo sends nothing anywhere
    if (!demo) useDimeAsk.getState().put(team.team_id, text);
    closeAsk();
    doors.dime(team, rowEl(team.team_id), null);
  };

  // ---- keys

  const latest = useRef({ teams, picked, pane, ask, back, doors });
  latest.current = { teams, picked, pane, ask, back, doors };
  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
    };
    const inDialog = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('[role="dialog"]');
    const control = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "BUTTON" || el.tagName === "A");
    };
    const onKey = (e: KeyboardEvent) => {
      const L = latest.current;
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || inDialog(e.target)) return;
      const i = L.teams.findIndex((t) => t.team_id === L.picked);
      const move = (to: number) => {
        const next = L.teams[Math.max(0, Math.min(L.teams.length - 1, to))];
        if (next) pick(next.team_id);
      };
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        move(i + 1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        move(i - 1);
      } else if (e.key === "Enter" || e.key === "ArrowRight") {
        if (e.key === "Enter" && control(e.target)) return;
        const t = L.teams[i];
        if (!t) return;
        e.preventDefault();
        L.doors.week(t, L.pane === "team" ? document.getElementById("home-team-page") : weekEl(t.team_id));
      } else if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        L.ask();
      } else if (e.key === "n" || e.key === "N") {
        const to = nextNeeding(L.teams, Math.max(0, i));
        if (to != null) pick(L.teams[to].team_id);
      } else if (e.key === "Escape") {
        if (L.pane === "team") L.back();
      } else if (e.key === "t" || e.key === "T") {
        toggleTheme();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick, toggleTheme]);

  // ---- the body

  let body: React.ReactNode;
  if (model.status === "signed-out") {
    body = (
      <div className={s.hero}>
        <span className={s.heroTitle}>Sign in to see your teams</span>
        <span className={s.heroSub}>Every team you manage on one screen: which ones need you tonight, how each matchup stands, and what is already taken care of.</span>
        <div className={s.heroRow}>
          <Link href={`/sign-in?redirect_url=${encodeURIComponent(HOME_DESK)}`} className={`${dk.btn} ${dk.btnPrimary}`}>
            Sign in
          </Link>
          <Link href={`${HOME_DESK}?demo`} className={dk.btn}>
            See the demo
          </Link>
        </div>
      </div>
    );
  } else if (model.status === "error") {
    body = (
      <div className={s.hero}>
        <span className={s.heroTitle}>Your teams could not be read</span>
        <span className={s.heroSub}>{model.message}</span>
        <div className={s.heroRow}>
          <button type="button" className={dk.btn} onClick={model.refetch}>
            Try again
          </button>
        </div>
      </div>
    );
  } else if (model.status === "loading" || !data) {
    body = (
      <div aria-busy style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={s.skelRow}>
            <span className={dk.skel} style={{ width: `${34 - i * 4}%` }} />
            <span className={dk.skel} style={{ width: `${72 - i * 9}%` }} />
            <span className={dk.skel} style={{ width: `${55 - i * 6}%` }} />
          </div>
        ))}
      </div>
    );
  } else if (!teams.length) {
    body = (
      <div className={s.hero}>
        <span className={s.heroTitle}>No teams yet</span>
        <span className={s.heroSub}>Add an ESPN or Yahoo team and it shows here, with every other team you add after it.</span>
        <div className={s.heroRow}>
          <Link href={`${ACCOUNT.href}?add`} className={`${dk.btn} ${dk.btnPrimary}`}>
            Add a team
          </Link>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <HomeTape data={data} now={now} tz={tz} />
        <div className={s.body} data-pane={pane}>
          <Board data={data} picked={picked} lasts={model.lasts} now={now} tz={tz} demo={demo} doors={doors} onPick={onPick} />
          {team ? (
            <TeamSide key={team.team_id} team={team} duel={duel} duelLoading={duelLoading} last={model.lasts.get(team.team_id)} now={now} tz={tz} doors={doors} onBack={back} />
          ) : null}
        </div>
      </>
    );
  }

  const read = data ? localClock(Date.parse(data.as_of), { tz }) : null;
  const report = hint ?? (model.stale ? `couldn't be read again · showing ${read}` : model.fetching && data ? "reading again…" : read ? `read ${read}` : "");

  return (
    <div className={dk.desk}>
      <DeskBar desk="home" demo={demo} onRefresh={demo || model.status !== "ready" ? undefined : model.refetch}>
        {asking && team ? (
          <form className={s.ask} onSubmit={onAsk}>
            <span className={dk.sub} style={{ whiteSpace: "nowrap" }}>
              Ask <span className={dk.spectrumText}>Dime</span> about {team.team_name}
            </span>
            <input
              className={s.askInput}
              autoFocus
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  closeAsk();
                }
              }}
              onBlur={() => {
                if (!question.trim()) closeAsk();
              }}
              placeholder="Who should I start tonight?"
              aria-label={`Ask Dime about ${team.team_name}`}
              maxLength={2000}
            />
            <span className={dk.sub} style={{ whiteSpace: "nowrap" }}>
              <span className={dk.kbd}>⏎</span> ask <span className={dk.kbd}>Esc</span> close
            </span>
          </form>
        ) : (
          <>
            <span style={{ fontWeight: 600 }}>Your teams</span>
            <span className={dk.sub}>{data ? `${teams.length} ${teams.length === 1 ? "team" : "teams"}` : ""}</span>
          </>
        )}
      </DeskBar>

      {body}

      <DeskStatus keys={KEYS}>
        <span className={hint ? s.hint : undefined}>{report}</span>
      </DeskStatus>
    </div>
  );
}
