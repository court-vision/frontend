"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { LayoutList } from "lucide-react";
import { DeskBar, DeskStatus } from "@/components/desk/DeskBar";
import { useDeskTheme } from "@/components/desk/useDeskTheme";
import { getTodayDate } from "@/hooks/useGames";
import { useRankingsListQuery } from "@/hooks/useRankings";
import { useLiveLeadersQuery } from "@/hooks/useScout";
import { useSeason } from "@/hooks/useSeason";
import { userMessage } from "@/lib/api-error";
import { DEFAULT_9CAT } from "@/lib/category-format";
import { LENSES, dayName, focusFromSearch, focusKey, focusToSearch, lensInfo, lensOf, nextLens, nextWindow, sameFocus, teamInfo, windowLabel, type Focus, type Window } from "@/lib/scout";
import type { RankingsParams } from "@/types/rankings";
import { Bench } from "./Bench";
import { BoardSheet } from "./BoardSheet";
import { CompareSheet } from "./CompareSheet";
import { Ledger, type PoolState } from "./Ledger";
import { MarketOverview, MarketSheet, PoolOverview, TeamsOverview } from "./Overviews";
import { PlayerSheet } from "./PlayerSheet";
import { SearchBox, fallbackName, type SearchPick } from "./SearchBox";
import { GameSheet, SlateOverview, type LiveCtx } from "./Slate";
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
 * the lens, the window, the pool's controls and the bench live in the store.
 * Each lens has an overview as the first row of its sidebar; switching
 * lenses leaves the sheet alone and parks the cursor on that row.
 */
export function ScoutPage({ initialFocus }: { initialFocus: Focus | null }) {
  const pathname = usePathname();
  const [focus, setFocusState] = useState<Focus | null>(initialFocus);
  const [compare, setCompare] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [pane, setPane] = useState<"list" | "sheet">(initialFocus ? "sheet" : "list");
  const [identities, setIdentities] = useState<Record<number, Identity>>({});
  const [today] = useState(() => getTodayDate());
  const [slateDay, setSlateDay] = useState(() => (initialFocus?.kind === "game" ? initialFocus.date : today));
  const rows = useRef<Focus[]>([]);
  const sheet = useRef<HTMLElement>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const initialRef = useRef(initialFocus);
  initialRef.current = initialFocus;

  const lens = useScoutStore((st) => st.lens);
  const setLensStore = useScoutStore((st) => st.setLens);
  const window_ = useScoutStore((st) => st.window);
  const setWindow = useScoutStore((st) => st.setWindow);
  const poolConfig = useScoutStore((st) => st.pool);
  const setPoolConfig = useScoutStore((st) => st.setPool);
  const pinned = useScoutStore((st) => st.pinned);
  const togglePin = useScoutStore((st) => st.togglePin);
  const unpin = useScoutStore((st) => st.unpin);
  const clearPins = useScoutStore((st) => st.clearPins);
  const recent = useScoutStore((st) => st.recent);
  const remember = useScoutStore((st) => st.remember);
  const toggleTheme = useDeskTheme((st) => st.toggle);
  useEffect(() => {
    void useScoutStore.persist?.rehydrate();
    // A link into the desk shows its own lens's sidebar.
    const f = initialRef.current;
    if (f) useScoutStore.getState().setLens(lensOf(f));
  }, []);

  // Switching lenses leaves the sheet alone and parks the cursor on the overview row.
  const setLens = useCallback(
    (l: typeof lens) => {
      setLensStore(l);
      setCursor(0);
      setPane("list");
    },
    [setLensStore]
  );

  // The pool: every ranked player, scored the way the rankings board says.
  const params = useMemo<RankingsParams>(() => ({ scope: "global", format: poolConfig.format, window: poolConfig.span, categories: null, minGames: null }), [poolConfig.format, poolConfig.span]);
  const pool = useRankingsListQuery(params);
  const poolRows = useMemo(() => pool.data?.players ?? [], [pool.data]);
  const poolById = useMemo(() => new Map(poolRows.map((r) => [r.id, r])), [poolRows]);
  const categories = pool.data?.meta?.categories?.length ? pool.data.meta.categories : DEFAULT_9CAT;
  const poolState: PoolState = {
    rows: poolRows,
    loading: pool.isLoading,
    error: pool.error ? userMessage(pool.error, "Couldn't load the pool") : null,
    message: pool.data?.message ?? "",
  };

  const leaders = useLiveLeadersQuery(true);
  const liveGames = useMemo(() => new Set((leaders.data?.players ?? []).filter((p) => p.game_status === 2).map((p) => p.game_id)).size, [leaders.data]);
  const season = useSeason();
  const seasonNote = season.isUpcoming ? `The ${season.label} season opens ${season.regularSeasonStart.slice(5).replace("-", "/")}; until then the numbers are ${season.prevLabel}'s.` : null;
  const liveLeaders = leaders.data?.gameDate === today ? leaders.data.players : undefined;
  const live: LiveCtx = { leaders: liveLeaders, leadersLoading: leaders.isLoading, poolById };

  // ---- focus ↔ URL

  const open = useCallback(
    (f: Focus | null, mode: "push" | "replace" = "push") => {
      setFocusState(f);
      setCompare(false);
      if (f) {
        remember(f);
        setPane("sheet");
        if (f.kind === "game") setSlateDay(f.date);
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

  const onSearchPick = useCallback(
    (pick: SearchPick) => {
      if (pick.kind === "night") {
        setLensStore("slate");
        setSlateDay(pick.date);
        setCursor(0);
        open({ kind: "overview", lens: "slate" });
        setPane("list");
        return;
      }
      open(pick);
    },
    [open, setLensStore]
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
      return fallbackName(f, today);
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

  // ---- keys

  const teamOfRef = useRef(teamOf);
  teamOfRef.current = teamOf;
  const latest = useRef({ lens, window: window_, focus, compare, searchOpen, canCompare, cursor });
  latest.current = { lens, window: window_, focus, compare, searchOpen, canCompare, cursor };
  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
    };
    const onKey = (e: KeyboardEvent) => {
      const L = latest.current;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInput.current?.focus();
        searchInput.current?.select();
        return;
      }
      if (L.searchOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      if (typing(e.target)) return;
      switch (e.key) {
        case "/":
          e.preventDefault();
          searchInput.current?.focus();
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

  const showCompare = compare && canCompare;
  const context = showCompare
    ? `Compare · ${pinnedPlayers.length}`
    : focus
      ? focus.kind === "player"
        ? `${nameOf(focus)}${teamOf(focus) ? ` · ${teamOf(focus)}` : ""}`
        : focus.kind === "overview"
          ? lensInfo(focus.lens).overview
          : nameOf(focus)
      : "Board";
  const focusLive = focus?.kind === "player" ? liveLeaders?.find((p) => p.player_id === focus.id && p.game_status >= 2) : undefined;

  let sheetBody: React.ReactNode;
  if (showCompare) {
    sheetBody = <CompareSheet ids={pinnedPlayers} window={window_} poolById={poolById} open={(f) => open(f)} unpin={unpin} close={() => setCompare(false)} />;
  } else if (!focus) {
    sheetBody = (
      <BoardSheet
        today={today}
        open={(f) => open(f)}
        setLens={setLens}
        openSearch={() => searchInput.current?.focus()}
        leaders={liveLeaders}
        leadersLoading={leaders.isLoading}
        recent={recent}
        nameOf={nameOf}
        pool={poolRows}
        poolById={poolById}
        seasonNote={seasonNote}
      />
    );
  } else if (focus.kind === "player") {
    sheetBody = (
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
    );
  } else if (focus.kind === "team") {
    sheetBody = <TeamSheet key={focus.abbrev} abbrev={focus.abbrev} today={today} open={(f) => open(f)} pinned={isPinned} togglePin={() => togglePin(focus)} />;
  } else if (focus.kind === "game") {
    sheetBody = <GameSheet key={`${focus.date}:${focus.gameId}`} date={focus.date} gameId={focus.gameId} today={today} open={(f) => open(f)} live={live} />;
  } else if (focus.kind === "market") {
    sheetBody = <MarketSheet key={focus.section} section={focus.section} open={(f) => open(f)} focus={focus} />;
  } else if (focus.lens === "pool") {
    sheetBody = <PoolOverview rows={poolRows} loading={pool.isLoading} error={poolState.error} message={poolState.message} meta={pool.data?.meta ?? null} config={poolConfig} setConfig={setPoolConfig} categories={categories} focus={focus} open={(f) => open(f)} />;
  } else if (focus.lens === "teams") {
    sheetBody = <TeamsOverview focus={focus} open={(f) => open(f)} />;
  } else if (focus.lens === "slate") {
    sheetBody = <SlateOverview today={today} open={(f) => open(f)} live={live} />;
  } else {
    sheetBody = <MarketOverview open={(f) => open(f)} focus={focus} />;
  }

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

      <div className={s.toolbar} data-search={searchOpen}>
        <div className={s.toolLeft}>
          <button type="button" className={`${dk.btn} ${dk.btnSmall} ${s.listToggle}`} onClick={() => setPane((p) => (p === "list" ? "sheet" : "list"))} aria-pressed={pane === "list"}>
            <LayoutList size={13} />
            {pane === "list" ? "Sheet" : "List"}
          </button>
          <div className={dk.rail} role="radiogroup" aria-label="Lens">
            {LENSES.map((l) => {
              const on = lens === l.id;
              return (
                <button key={l.id} type="button" role="radio" aria-checked={on} className={`${dk.seg} ${on ? dk.segOn : ""}`} onClick={() => setLens(l.id)} title={l.title}>
                  {on ? <motion.span layoutId="lens-pill" className={dk.segPill} transition={{ type: "spring", stiffness: 600, damping: 45 }} /> : null}
                  <span className={dk.segLabel}>{l.label}</span>
                </button>
              );
            })}
          </div>
          <span className={dk.kbd}>[ ]</span>
        </div>
        <div className={s.toolCenter}>
          <SearchBox pool={poolRows} recent={recent} today={today} onPick={onSearchPick} nameOf={nameOf} inputRef={searchInput} onOpenChange={setSearchOpen} />
        </div>
        <div className={s.toolRight}>
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
        </div>
      </div>

      <Bench pinned={pinned} focus={focus} compare={showCompare} nameOf={nameOf} open={(f) => open(f)} unpin={unpin} clear={clearPins} toggleCompare={() => setCompare((v) => !v)} />

      <div className={`${s.body} ${dk.desk}`} data-pane={pane}>
        <aside className={s.ledger}>
          <Ledger lens={lens} focus={focus} open={(f) => open(f)} cursor={cursor} setCursor={setCursor} onRows={onRows} pool={poolState} today={today} slateDay={slateDay} setSlateDay={setSlateDay} />
        </aside>
        <main ref={sheet} className={s.sheet} tabIndex={-1} aria-live="polite">
          {sheetBody}
        </main>
      </div>

      <DeskStatus keys={KEYS}>
        {pool.data?.meta ? (
          <span>
            Pool · {pool.data.meta.season ?? season.label} · {pool.data.meta.pool_size} players
            {pool.data.meta.as_of ? ` · as of ${pool.data.meta.as_of}` : ""}
          </span>
        ) : null}
        {focus?.kind === "game" ? <span>{dayName(focus.date, today)}</span> : null}
      </DeskStatus>
    </>
  );
}
