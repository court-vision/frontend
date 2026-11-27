"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { DeskBar, DeskStatus } from "@/components/desk/DeskBar";
import { ACCOUNT_DESK, TEAM_DESK } from "@/components/desk/routes";
import { SegRail } from "@/components/desk/SegRail";
import { TeamSwitch, type DeskTeam } from "@/components/desk/TeamSwitch";
import { useDeskTheme } from "@/components/desk/useDeskTheme";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import { useLeagueProjectionsQuery, useLeagueValuesQuery, useStreamingLineQuery } from "@/hooks/useTeamDesk";
import { teamName, teamTag } from "@/lib/account";
import { toApiError, userMessage } from "@/lib/api-error";
import {
  WINDOWS,
  dayRange,
  lineWindow,
  matchupSpan,
  ordinal,
  startersOf,
  teamTracks,
  tierRows,
  weekBars,
  windowDef,
  windowFromParam,
} from "@/lib/team-desk";
import type { TeamDemo } from "@/lib/team-desk-demo";
import { useUIStore } from "@/stores/useUIStore";
import { toScoringFormat } from "@/types/scoring";
import type { LeagueProjectionData, LeagueValuesData, StreamingLineData, ValueWindowKey } from "@/types/team-desk";
import { Pane, PaneError, PaneSkeleton, StreamLine, Tape, Tiers, Tracks } from "./Panels";
import { WeekChart } from "./WeekChart";
import dk from "@/components/desk/desk.module.css";
import s from "./team.module.css";

const KEYS: Array<[string, string]> = [
  ["1–5", "window"],
  ["T", "theme"],
];

/** The league reads refuse any league but an ESPN points league with these. */
const UNSUPPORTED = new Set(["LEAGUE_PROJECTION_ESPN_ONLY", "LEAGUE_PROJECTION_POINTS_ONLY"]);

// ---------------------------------------------------------------------------
// The desk's model: the signed-in account's reads, or the demo's
// ---------------------------------------------------------------------------

interface Read<T> {
  data: T | undefined;
  error: unknown;
  /** Nothing to show yet. */
  loading: boolean;
  /** A read is under way behind what is shown (a window change keeps the last one up). */
  fetching: boolean;
  refetch: () => void;
}

interface TeamModel {
  demo: boolean;
  status: "signed-out" | "loading" | "error" | "no-team" | "ready";
  message: string | null;
  teams: DeskTeam[];
  teamId: number | null;
  onTeam: (id: number) => void;
  /** Why this team's league can't be read here, when it can't. */
  unsupported: string | null;
  projections: Read<LeagueProjectionData>;
  values: Read<LeagueValuesData>;
  line: Read<StreamingLineData>;
  /** The window the line was asked for (the desk's, or the next four when the desk's is longer). */
  lineKey: ValueWindowKey;
}

const NOTHING = () => {};

function idle<T>(data?: T): Read<T> {
  return { data, error: null, loading: data === undefined, fetching: false, refetch: NOTHING };
}

function readOf<T>(q: { data: T | undefined; error: unknown; isLoading: boolean; isFetching: boolean; refetch: () => unknown }): Read<T> {
  return { data: q.data, error: q.error, loading: q.isLoading, fetching: q.isFetching, refetch: () => void q.refetch() };
}

function useLiveTeam(window: ValueWindowKey): TeamModel {
  const { isLoaded, isSignedIn } = useAuth();
  const selected = useSelectedTeam();
  const setSelectedTeam = useUIStore((st) => st.setSelectedTeam);
  const teams = useMemo<DeskTeam[]>(() => selected.teams.map((t) => ({ id: t.team_id, name: teamName(t), tag: teamTag(t) })), [selected.teams]);
  const teamId = selected.teamId != null && teams.some((t) => t.id === selected.teamId) ? selected.teamId : (teams[0]?.id ?? null);
  const team = selected.teams.find((t) => t.team_id === teamId) ?? null;

  // The desk is on the team every desk is on; with none picked yet, the first
  useEffect(() => {
    if (teamId != null && selected.teamId !== teamId) setSelectedTeam(teamId);
  }, [teamId, selected.teamId, setSelectedTeam]);

  const provider = team?.league_info?.provider ?? null;
  const known =
    team && provider && provider !== "espn"
      ? "The Team desk reads ESPN leagues for now. Yahoo leagues come later."
      : team && toScoringFormat(team.league?.scoring_type, team.league?.settings_synced ?? false) === "categories"
        ? "The Team desk reads points leagues for now. Category leagues come later."
        : null;
  const on = !known;
  const projections = useLeagueProjectionsQuery(teamId, on);
  const refused = projections.error && UNSUPPORTED.has(toApiError(projections.error).code ?? "") ? userMessage(projections.error) : null;
  const unsupported = known ?? refused;
  const lineKey = lineWindow(window, projections.data?.playoff_matchups.length ?? null);
  const values = useLeagueValuesQuery(teamId, window, on && !refused);
  const line = useStreamingLineQuery(teamId, lineKey, on && !refused);

  const status: TeamModel["status"] = !isLoaded
    ? "loading"
    : !isSignedIn
      ? "signed-out"
      : selected.teamsError && !teams.length
        ? "error"
        : selected.isLoading
          ? "loading"
          : !teams.length
            ? "no-team"
            : "ready";
  return {
    demo: false,
    status,
    message: selected.teamsError ? userMessage(selected.teamsError, "Your teams could not be read.") : null,
    teams,
    teamId,
    onTeam: setSelectedTeam,
    unsupported,
    projections: readOf(projections),
    values: readOf(values),
    line: readOf(line),
    lineKey,
  };
}

function useDemoTeam(window: ValueWindowKey): TeamModel {
  const [demo, setDemo] = useState<TeamDemo | null>(null);
  const [team, setTeam] = useState<DeskTeam | null>(null);
  useEffect(() => {
    let live = true;
    void import("@/lib/team-desk-demo").then((m) => {
      if (!live) return;
      setDemo(m.TEAM_DEMO);
      setTeam(m.TEAM_DEMO_TEAM);
    });
    return () => {
      live = false;
    };
  }, []);
  const lineKey = lineWindow(window, demo?.projections.playoff_matchups.length ?? null);
  const values = useMemo(() => demo?.values(window), [demo, window]);
  const line = useMemo(() => demo?.line(lineKey) ?? undefined, [demo, lineKey]);
  return {
    demo: true,
    status: demo ? "ready" : "loading",
    message: null,
    teams: team ? [team] : [],
    teamId: team?.id ?? null,
    onTeam: NOTHING,
    unsupported: null,
    projections: idle(demo?.projections),
    values: idle(values),
    line: idle(line),
    lineKey,
  };
}

// ---------------------------------------------------------------------------
// The desk
// ---------------------------------------------------------------------------

export function TeamPage({ demo, initialWindow }: { demo: boolean; initialWindow: string | null }) {
  const [window, setWindow] = useState<ValueWindowKey>(() => windowFromParam(initialWindow));
  const onWindow = useCallback((w: ValueWindowKey) => {
    setWindow(w);
    // The window is in the address, so a reload or a shared link opens on it
    const q = new URLSearchParams(globalThis.location?.search ?? "");
    q.set("w", w);
    const search = q.toString().replace(/(^|&)demo=(?=&|$)/, "$1demo");
    globalThis.history?.replaceState(globalThis.history.state, "", `${TEAM_DESK}?${search}`);
  }, []);
  return demo ? <DemoTeam window={window} onWindow={onWindow} /> : <LiveTeam window={window} onWindow={onWindow} />;
}

interface DeskProps {
  window: ValueWindowKey;
  onWindow: (w: ValueWindowKey) => void;
}

function LiveTeam(props: DeskProps) {
  return <TeamDesk model={useLiveTeam(props.window)} {...props} />;
}

function DemoTeam(props: DeskProps) {
  return <TeamDesk model={useDemoTeam(props.window)} {...props} />;
}

/** The reads' notes, each said once: two reads note the calendar's gap in their own words, so the first word of it stands. */
function distinctNotes(notes: string[]): string[] {
  const seen = new Set<string>();
  return notes.filter((n) => {
    const head = n.split(" ").slice(0, 8).join(" ");
    if (seen.has(head)) return false;
    seen.add(head);
    return true;
  });
}

function Hero({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className={s.hero}>
      <span className={s.heroTitle}>{title}</span>
      <span className={s.heroSub}>{sub}</span>
      {children ? <div className={s.heroRow}>{children}</div> : null}
    </div>
  );
}

function TeamDesk({ model, window, onWindow }: { model: TeamModel } & DeskProps) {
  const router = useRouter();
  const toggleTheme = useDeskTheme((st) => st.toggle);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const { demo, projections, values, line } = model;
  const p = projections.data;
  const v = values.data;
  const def = windowDef(window);

  const starters = startersOf(p?.lineup_slots);
  const playoffTeams = p?.playoff_teams ?? Math.ceil((p?.teams_count ?? 8) / 2);
  const bars = useMemo(() => (p ? weekBars(p) : []), [p]);
  const tiers = useMemo(() => (v ? tierRows(v) : null), [v]);
  const tracks = useMemo(() => (v ? teamTracks(v, { starters, playoffTeams }) : null), [v, starters, playoffTeams]);
  const winRange = v ? { first: v.window.first_matchup, last: v.window.last_matchup } : null;
  const windowLabel = v ? `${matchupSpan(v.window.first_matchup, v.window.last_matchup)} · ${dayRange(v.window.start, v.window.end)}` : def.label;

  const refetch = useCallback(() => {
    projections.refetch();
    values.refetch();
    line.refetch();
  }, [projections, values, line]);

  // ---- keys: 1 to 5 the window, T the theme

  const latest = useRef({ onWindow });
  useLayoutEffect(() => {
    latest.current = { onWindow };
  });
  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || (e.target as HTMLElement | null)?.closest?.('[role="dialog"]')) return;
      const i = Number(e.key);
      if (Number.isInteger(i) && i >= 1 && i <= WINDOWS.length) {
        e.preventDefault();
        latest.current.onWindow(WINDOWS[i - 1].key);
      } else if (e.key === "t" || e.key === "T") {
        toggleTheme();
      }
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [toggleTheme]);

  // ---- the body

  let body: React.ReactNode;
  if (model.status === "signed-out") {
    body = (
      <Hero title="Sign in to test your team" sub="Your team against every other roster in its league, projected the same way: your weeks, where your points come from, your roster by tier and the streaming line.">
        <Link href={`/sign-in?redirect_url=${encodeURIComponent(TEAM_DESK)}`} className={`${dk.btn} ${dk.btnPrimary}`}>
          Sign in
        </Link>
        <Link href={`${TEAM_DESK}?demo`} className={dk.btn}>
          See the demo
        </Link>
      </Hero>
    );
  } else if (model.status === "error") {
    body = <Hero title="Your teams could not be read" sub={model.message ?? "Try again in a moment."} />;
  } else if (model.status === "loading") {
    body = (
      <div className={s.main} aria-busy>
        <Tape p={undefined} tiers={null} starters={starters} windowLabel={def.label} />
        <div className={s.chartPane}>
          <PaneSkeleton rows={4} />
        </div>
      </div>
    );
  } else if (model.status === "no-team") {
    body = (
      <Hero title="No teams yet" sub="Add an ESPN team and the desk tests it against the rest of its league.">
        <Link href={`${ACCOUNT_DESK}?add`} className={`${dk.btn} ${dk.btnPrimary}`}>
          Add a team
        </Link>
      </Hero>
    );
  } else if (model.unsupported) {
    body = <Hero title="This team's league can't be read here yet" sub={model.unsupported} />;
  } else {
    const failed = projections.error && !p;
    body = (
      <div className={s.main}>
        {failed ? (
          <div className={s.tapeError}>
            <PaneError message={userMessage(projections.error, "The league's projections could not be read.")} onRetry={projections.refetch} />
          </div>
        ) : (
          <Tape p={p} tiers={tiers} starters={starters} windowLabel={def.label.toLowerCase()} />
        )}

        <section className={s.chartPane} aria-label="Your week against the league's">
          <header className={s.chartHead}>
            <span className={dk.label} style={{ color: "var(--text-2)" }}>
              Your week against the league&apos;s, matchup by matchup
            </span>
            <span className={s.legend}>
              <span>
                <i className={s.swYou} />
                you, against the median
              </span>
              <span>
                <i className={s.swBand} />
                league&apos;s middle half
              </span>
              <span>
                <i className={s.swLine} />
                playoff line{p ? ` (${ordinal(p.playoff_teams)})` : ""}
              </span>
              <span>
                <i className={s.swBest} />
                best
              </span>
              <span>
                <i className={s.swDot} />
                clears the line
              </span>
              <span>
                <i className={s.swWindow} />
                {def.label.toLowerCase()}
              </span>
            </span>
          </header>
          {p ? <WeekChart bars={bars} window={winRange} /> : failed ? null : <PaneSkeleton rows={4} />}
        </section>

        <div className={s.grid}>
          <Pane title="Where your points come from" sub={v ? `${def.label.toLowerCase()} · ${v.window.days} days` : def.label.toLowerCase()} className={s.paneTracks}>
            {tracks ? (
              <div className={values.fetching ? s.stale : undefined}>
                <Tracks tracks={tracks} />
              </div>
            ) : values.error ? (
              <PaneError message={userMessage(values.error, "The league's players could not be priced.")} onRetry={values.refetch} />
            ) : (
              <PaneSkeleton rows={7} />
            )}
          </Pane>

          <Pane title="Your roster by tier" sub={`vs the league's average Nth best · ${def.label.toLowerCase()}`} className={s.paneTiers}>
            {tiers ? (
              <div className={values.fetching ? s.stale : undefined}>
                <Tiers rows={tiers} starters={starters} />
              </div>
            ) : values.error ? (
              <PaneError message={userMessage(values.error, "The league's players could not be priced.")} onRetry={values.refetch} />
            ) : (
              <PaneSkeleton rows={10} />
            )}
          </Pane>

          <Pane title="The streaming line" sub={line.data ? `matchups ${matchupSpan(line.data.first_matchup, line.data.last_matchup)}` : windowDef(model.lineKey).label.toLowerCase()} className={s.paneLine}>
            {line.data ? (
              <div className={line.fetching ? s.stale : undefined}>
                <StreamLine data={line.data} asked={window} readOver={model.lineKey} />
              </div>
            ) : line.error ? (
              <PaneError message={userMessage(line.error, "The streaming line could not be worked out.")} onRetry={line.refetch} />
            ) : (
              <PaneSkeleton rows={9} />
            )}
          </Pane>
        </div>

        {p || v ? (
          <footer className={s.notes}>
            {distinctNotes([...(p?.notes ?? []), ...(v?.notes ?? [])]).map((n) => (
                <p key={n}>{n}</p>
              ))}
          </footer>
        ) : null}
      </div>
    );
  }

  const busy = projections.fetching || values.fetching || line.fetching;
  const report = demo
    ? "Sample league · Nov 27, 2026"
    : busy && (p || v)
      ? "reading the league…"
      : p
        ? `projected ${p.projection_as_of ?? p.today} · ${p.simulations.toLocaleString("en-US")} seasons simulated`
        : "";

  return (
    <div ref={setRoot} className={dk.desk}>
      <DeskBar
        desk="team"
        demo={demo}
        onRefresh={demo || model.status !== "ready" || model.unsupported ? undefined : refetch}
        right={
          p ? (
            <span className={dk.sub} title="Every roster in the league projected the same way as yours">
              {p.playoff_teams} of {p.teams_count} make the playoffs
            </span>
          ) : null
        }
      >
        {model.status === "ready" || model.teams.length ? (
          <TeamSwitch teams={model.teams} teamId={model.teamId} onTeam={model.onTeam} onAdd={demo ? undefined : () => router.push(`${ACCOUNT_DESK}?add=1`)} demo={demo} container={root} />
        ) : null}
        {p?.league_name ? <span className={dk.sub}>{p.league_name}</span> : null}
      </DeskBar>

      {model.status === "ready" && !model.unsupported ? (
        <div className={s.toolbar}>
          <SegRail label="Window" active={window}>
            {WINDOWS.map((w, i) => {
              const on = window === w.key;
              return (
                <button key={w.key} type="button" role="radio" aria-checked={on} className={`${dk.seg} ${on ? dk.segOn : ""}`} onClick={() => onWindow(w.key)} title={`${w.label} (${i + 1})`}>
                  <span className={dk.segLabel}>{w.label}</span>
                </button>
              );
            })}
          </SegRail>
          <span className={dk.kbd}>1–5</span>
          <span className={s.windowSpan}>{v && v.window.key === window ? `matchups ${windowLabel}` : ""}</span>
          <span className={s.benchmark}>
            <span className={dk.label}>Benchmark</span>
            <span>the league&apos;s {p?.teams_count ?? ""} rosters, projected the same way as yours</span>
          </span>
        </div>
      ) : null}

      {body}

      <DeskStatus keys={KEYS}>
        <span>{report}</span>
      </DeskStatus>
    </div>
  );
}
