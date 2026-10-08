"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { LayoutList, Search } from "lucide-react";
import { DeskBar, DeskStatus } from "@/components/desk/DeskBar";
import { useDeskTheme } from "@/components/desk/useDeskTheme";
import { getTodayDate } from "@/hooks/useGames";
import { useRankingsListQuery } from "@/hooks/useRankings";
import { useLiveLeadersQuery } from "@/hooks/useScout";
import { useSeason } from "@/hooks/useSeason";
import { userMessage } from "@/lib/api-error";
import { DEFAULT_9CAT } from "@/lib/category-format";
import { formatSeasonDate } from "@/lib/season";
import {
  LENSES,
  dayName,
  focusFromSearch,
  focusKey,
  focusToSearch,
  nextLens,
  nextWindow,
  sameFocus,
  teamInfo,
  windowLabel,
  type Focus,
  type Lens,
  type Window,
} from "@/lib/scout";
import type { RankingsParams, RankingsWindow } from "@/types/rankings";
import type { ScoringFormat } from "@/types/scoring";
import { Bench } from "./Bench";
import { BoardSheet } from "./BoardSheet";
import { CompareSheet } from "./CompareSheet";
import { Finder, fallbackName } from "./Finder";
import { Ledger, type PoolState } from "./Ledger";
import { PlayerSheet } from "./PlayerSheet";
import { SlateSheet } from "./SlateSheet";
import { TeamSheet } from "./TeamSheet";
import { useScoutStore } from "./useScoutStore";
import dk from "@/components/desk/desk.module.css";
import s from "./scout.module.css";

const KEYS: Array<[string, string]> = [
  ["/", "find"],
  ["[ ]", "lens"],
  ["↑↓", "move"],
  ["⏎", "open"],
  ["← →", "flip"],
  ["W", "window"],
  ["P", "pin"],
  ["C", "compare"],
  ["G", "team"],
  ["T", "theme"],
  ["esc", "board"],
];

interface Identity {
  id: number;
  name: string;
  team: string | null;
}

/**
 * The Scout desk. The focus (what the sheet shows) lives in the URL, so a
 * link opens what it names and the browser's back button retraces the trail;
 * the lens, the window and the bench live in the store.
 */
export function ScoutPage({ initialFocus }: { initialFocus: Focus | null }) {
  const pathname = usePathname();
  const [focus, setFocusState] = useState<Focus | null>(initialFocus);
  const [compare, setCompare] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [pane, setPane] = useState<"list" | "sheet">(initialFocus ? "sheet" : "list");
  const [poolFormat, setPoolFormat] = useState<ScoringFormat>("points");
  const [poolSpan, setPoolSpan] = useState<RankingsWindow>(null);
  const [identities, setIdentities] = useState<Record<number, Identity>>({});
  const rows = useRef<Focus[]>([]);
  const sheet = useRef<HTMLElement>(null);
  const [today] = useState(() => getTodayDate());

  const lens = useScoutStore((st) => st.lens);
  const setLens = useScoutStore((st) => st.setLens);
  const window_ = useScoutStore((st) => st.window);
  const setWindow = useScoutStore((st) => st.setWindow);
  const pinned = useScoutStore((st) => st.pinned);
  const togglePin = useScoutStore((st) => st.togglePin);
  const unpin = useScoutStore((st) => st.unpin);
  const clearPins = useScoutStore((st) => st.clearPins);
  const recent = useScoutStore((st) => st.recent);
  const remember = useScoutStore((st) => st.remember);
  const toggleTheme = useDeskTheme((st) => st.toggle);
  useEffect(() => {
    void useScoutStore.persist?.rehydrate();
  }, []);

  // The pool: every ranked player, scored the way the rail says.
  const params = useMemo<RankingsParams>(() => ({ scope: "global", format: poolFormat, window: poolSpan, categories: null, minGames: null }), [poolFormat, poolSpan]);
  const pool = useRankingsListQuery(params);
  const poolRows = useMemo(() => pool.data?.players ?? [], [pool.data]);
  const poolById = useMemo(() => new Map(poolRows.map((r) => [r.id, r])), [poolRows]);
  const categories = pool.data?.meta?.categories?.length ? pool.data.meta.categories : DEFAULT_9CAT;
  const poolState: PoolState = {
    rows: poolRows,
    loading: pool.isLoading,
    error: pool.error ? userMessage(pool.error, "Couldn't load the pool") : null,
    message: pool.data?.message ?? "",
    format: poolFormat,
    setFormat: setPoolFormat,
    span: poolSpan,
    setSpan: setPoolSpan,
  };

  const leaders = useLiveLeadersQuery(true);
  const liveGames = useMemo(() => new Set((leaders.data?.players ?? []).filter((p) => p.game_status === 2).map((p) => p.game_id)).size, [leaders.data]);
  const season = useSeason();
  const seasonNote = season.isUpcoming ? `The ${season.label} season opens ${formatSeasonDate(season.regularSeasonStart)}; until then the numbers are ${season.prevLabel}'s.` : null;

  // ---- focus ↔ URL

  const open = useCallback(
    (f: Focus | null, mode: "push" | "replace" = "push") => {
      setFocusState(f);
      setCompare(false);
      if (f) {
        remember(f);
        setPane("sheet");
      } else {
        setPane("list");
      }
      const url = `${pathname}${focusToSearch(f)}`;
      if (`${window.location.pathname}${window.location.search}` !== url) {
        if (mode === "push") window.history.pushState(null, "", url);
        else window.history.replaceState(null, "", url);
      }
    },
    [pathname, remember]
  );

  useEffect(() => {
    const onPop = () => {
      setFocusState(focusFromSearch(new URLSearchParams(window.location.search)));
      setCompare(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // A server re-render with a different URL (a link into the desk) wins over local state.
  const initialKey = initialFocus ? focusKey(initialFocus) : "";
  const initialRef = useRef(initialFocus);
  initialRef.current = initialFocus;
  useEffect(() => {
    setFocusState(initialRef.current);
  }, [initialKey]);

  useEffect(() => {
    sheet.current?.scrollTo({ top: 0 });
  }, [focus, compare]);

  // ---- names

  const onIdentity = useCallback((i: Identity) => {
    setIdentities((prev) => (prev[i.id]?.name === i.name && prev[i.id]?.team === i.team ? prev : { ...prev, [i.id]: i }));
  }, []);
  const nameOf = useCallback(
    (f: Focus): string => {
      if (f.kind === "player") return identities[f.id]?.name ?? poolById.get(f.id)?.player_name ?? fallbackName(f, today);
      if (f.kind === "team") return teamInfo(f.abbrev)?.name ?? f.abbrev;
      return dayName(f.date, today);
    },
    [identities, poolById, today]
  );
  const teamOf = (f: Focus | null): string | null => (f?.kind === "player" ? identities[f.id]?.team ?? poolById.get(f.id)?.team ?? null : f?.kind === "team" ? f.abbrev : null);

  // ---- the bench

  const pinnedPlayers = useMemo(() => pinned.filter((p): p is Extract<Focus, { kind: "player" }> => p.kind === "player").map((p) => p.id), [pinned]);
  const canCompare = pinnedPlayers.length >= 2;
  const isPinned = focus != null && pinned.some((p) => sameFocus(p, focus));

  // ---- the ledger's rows and cursor

  const onRows = useCallback((list: Focus[]) => {
    rows.current = list;
    setCursor((c) => Math.min(c, Math.max(0, list.length - 1)));
  }, []);
  useEffect(() => {
    const i = focus ? rows.current.findIndex((r) => sameFocus(r, focus)) : -1;
    setCursor(i >= 0 ? i : 0);
  }, [lens, focus]);

  // ---- keys

  const teamOfRef = useRef(teamOf);
  teamOfRef.current = teamOf;
  const latest = useRef({ lens, window: window_, focus, compare, finderOpen, canCompare, cursor });
  latest.current = { lens, window: window_, focus, compare, finderOpen, canCompare, cursor };
  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
    };
    const onKey = (e: KeyboardEvent) => {
      const L = latest.current;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setFinderOpen(true);
        return;
      }
      if (L.finderOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      if (typing(e.target)) return;
      switch (e.key) {
        case "/":
          e.preventDefault();
          setFinderOpen(true);
          return;
        case "[":
          setLens(nextLens(L.lens, -1));
          return;
        case "]":
          setLens(nextLens(L.lens, 1));
          return;
        case "w":
          setWindow(nextWindow(L.window, 1));
          return;
        case "W":
          setWindow(nextWindow(L.window, -1));
          return;
        case "p":
        case "P":
          if (L.focus) togglePin(L.focus);
          return;
        case "c":
        case "C":
          if (L.canCompare) setCompare((v) => !v);
          return;
        case "t":
        case "T":
          toggleTheme();
          return;
        case "g":
        case "G": {
          const team = teamOfRef.current(L.focus);
          if (team && L.focus?.kind === "player") open({ kind: "team", abbrev: team });
          return;
        }
        case "Escape":
          if (L.compare) setCompare(false);
          else open(null);
          return;
        case "ArrowDown":
        case "j":
          e.preventDefault();
          setCursor((c) => Math.min(rows.current.length - 1, c + 1));
          return;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          setCursor((c) => Math.max(0, c - 1));
          return;
        case "Enter": {
          const f = rows.current[L.cursor];
          if (f) open(f);
          return;
        }
        case "ArrowRight":
        case "ArrowLeft": {
          const list = rows.current;
          if (!list.length) return;
          e.preventDefault();
          const at = L.focus ? list.findIndex((r) => sameFocus(r, L.focus)) : -1;
          const base = at >= 0 ? at : L.cursor;
          const next = Math.max(0, Math.min(list.length - 1, base + (e.key === "ArrowRight" ? 1 : -1)));
          setCursor(next);
          open(list[next]);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setLens, setWindow, togglePin, toggleTheme]);

  // ---- render

  const context =
    compare && canCompare ? `Compare · ${pinnedPlayers.length}` : focus ? (focus.kind === "player" ? `${nameOf(focus)}${teamOf(focus) ? ` · ${teamOf(focus)}` : ""}` : nameOf(focus)) : "Board";
  const showCompare = compare && canCompare;
  const liveLeaders = leaders.data?.gameDate === today ? leaders.data.players : undefined;
  const focusLive = focus?.kind === "player" ? liveLeaders?.find((p) => p.player_id === focus.id && p.game_status >= 2) : undefined;

  return (
    <>
      <DeskBar
        desk="scout"
        right={
          liveGames > 0 ? (
            <span className={dk.badge}>
              <span className={dk.liveDot} />
              {liveGames} live
            </span>
          ) : null
        }
        onRefresh={() => {
          void pool.refetch();
          void leaders.refetch();
        }}
      >
        <span className={dk.label} style={{ color: "var(--text-2)", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>
          {context}
        </span>
      </DeskBar>

      <div className={s.toolbar}>
        <div className={dk.rail} role="radiogroup" aria-label="Lens">
          {LENSES.map((l) => {
            const on = lens === l.id;
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`${dk.seg} ${on ? dk.segOn : ""}`}
                onClick={() => {
                  setLens(l.id);
                  setPane("list");
                }}
                title={l.title}
              >
                {on ? <motion.span layoutId="lens-pill" className={dk.segPill} transition={{ type: "spring", stiffness: 600, damping: 45 }} /> : null}
                <span className={dk.segLabel}>{l.label}</span>
              </button>
            );
          })}
        </div>
        <span className={dk.kbd}>[ ]</span>
        <span className={dk.divider} />
        <button type="button" className={s.finderBtn} onClick={() => setFinderOpen(true)}>
          <Search size={13} />
          <span className={s.finderText}>Find a player, a team, or a night…</span>
          <span className={dk.kbd}>/</span>
        </button>
        <span className={dk.divider} />
        <span className={dk.label}>Window</span>
        <div className={dk.rail} role="radiogroup" aria-label="Stat window">
          {(["season", "l5", "l10", "l15", "l30"] as const).map((w: Window) => {
            const on = window_ === w;
            return (
              <button key={w} type="button" role="radio" aria-checked={on} className={`${dk.seg} ${on ? dk.segOn : ""}`} onClick={() => setWindow(w)} title="Per-game averages over the season or the last N games">
                {on ? <motion.span layoutId="window-pill" className={dk.segPill} transition={{ type: "spring", stiffness: 600, damping: 45 }} /> : null}
                <span className={dk.segLabel}>{windowLabel(w)}</span>
              </button>
            );
          })}
        </div>
        <span className={dk.kbd}>W</span>
        <span className={dk.spacer} />
        <button type="button" className={`${dk.btn} ${dk.btnSmall} ${s.listToggle}`} onClick={() => setPane((p) => (p === "list" ? "sheet" : "list"))} aria-pressed={pane === "list"}>
          <LayoutList size={13} />
          {pane === "list" ? "Sheet" : "List"}
        </button>
      </div>

      <Bench pinned={pinned} focus={focus} compare={showCompare} nameOf={nameOf} open={(f) => open(f)} unpin={unpin} clear={clearPins} toggleCompare={() => setCompare((v) => !v)} />

      <div className={`${s.body} ${dk.desk}`} data-pane={pane}>
        <aside className={s.ledger}>
          <Ledger lens={lens} focus={focus} open={(f) => open(f)} cursor={cursor} setCursor={setCursor} onRows={onRows} pool={poolState} today={today} />
        </aside>
        <main ref={sheet} className={s.sheet} tabIndex={-1} aria-live="polite">
          {showCompare ? (
            <CompareSheet ids={pinnedPlayers} window={window_} poolById={poolById} open={(f) => open(f)} unpin={unpin} close={() => setCompare(false)} />
          ) : focus?.kind === "player" ? (
            <PlayerSheet
              key={focus.id}
              id={focus.id}
              window={window_}
              setWindow={setWindow}
              poolRow={poolById.get(focus.id)}
              categories={categories}
              today={today}
              open={(f) => open(f)}
              pinned={isPinned}
              togglePin={() => togglePin(focus)}
              canCompare={canCompare}
              onCompare={() => setCompare(true)}
              live={focusLive}
              onIdentity={onIdentity}
            />
          ) : focus?.kind === "team" ? (
            <TeamSheet key={focus.abbrev} abbrev={focus.abbrev} today={today} open={(f) => open(f)} pinned={isPinned} togglePin={() => togglePin(focus)} />
          ) : focus?.kind === "slate" ? (
            <SlateSheet key={focus.date} date={focus.date} today={today} open={(f) => open(f)} leaders={liveLeaders} leadersLoading={leaders.isLoading} />
          ) : (
            <BoardSheet
              today={today}
              open={(f) => open(f)}
              setLens={(l: Lens) => {
                setLens(l);
                setPane("list");
              }}
              openFinder={() => setFinderOpen(true)}
              leaders={liveLeaders}
              leadersLoading={leaders.isLoading}
              recent={recent}
              nameOf={nameOf}
              pool={poolRows}
              seasonNote={seasonNote}
            />
          )}
        </main>
      </div>

      <DeskStatus keys={KEYS}>
        {pool.data?.meta ? (
          <span>
            Pool · {pool.data.meta.season ?? season.label} · {pool.data.meta.pool_size} players
            {pool.data.meta.as_of ? ` · as of ${pool.data.meta.as_of}` : ""}
          </span>
        ) : null}
      </DeskStatus>

      <Finder open={finderOpen} onOpenChange={setFinderOpen} pool={poolRows} recent={recent} today={today} onPick={(f) => open(f)} nameOf={nameOf} />
    </>
  );
}
