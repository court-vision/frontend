"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import { Command } from "cmdk";
import {
  Activity,
  ArrowUpRight,
  Braces,
  CalendarDays,
  Check,
  ClipboardList,
  ListOrdered,
  LogIn,
  LogOut,
  Palette,
  Plus,
  Search,
  SunMoon,
  MessagesSquare,
  Telescope,
  TrendingUp,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePlayerSearchQuery } from "@/hooks/useScout";
import { useTeamsQuery } from "@/hooks/useTeams";
import { leagueName, teamName, teamTag } from "@/lib/account";
import { groupMatches, type PaletteGroup } from "@/lib/palette";
import { directoryMatches, focusToSearch, LENSES, matchTeams, type Lens } from "@/lib/scout";
import { useUIStore } from "@/stores/useUIStore";
import { Headshot } from "./Headshot";
import { TeamLogo } from "./TeamLogo";
import { ACCOUNT_DESK, ALL_DESKS, isDeskDemo, SCOUT_DESK, WEEK_DESK, type DeskId } from "./routes";
import { DESK_THEMES, themePair } from "./themes";
import { useDeskTheme } from "./useDeskTheme";
import { usePalette, type PaletteCommand } from "./usePalette";
import dk from "./desk.module.css";

/** How long typing must pause before the directory is asked, as Scout's own box waits. */
const DIRECTORY_DEBOUNCE_MS = 150;

const DESK_ICONS: Record<DeskId, LucideIcon> = { week: CalendarDays, draft: ClipboardList, scout: Telescope, ai: MessagesSquare, developer: Braces, account: UserRound };
const LENS_ICONS: Record<Lens, LucideIcon> = { pool: Trophy, teams: ListOrdered, slate: Activity, market: TrendingUp };

/** The palette's own groups in the order they are listed; the desk's own group goes before them all. */
const GROUP_ORDER = ["Desks", "Scout", "Teams", "Theme", "Account"];

/**
 * ⌘K on every desk: the desks, Scout's lists, your teams, the themes and your
 * account as commands, and any player or NBA team by name, which open in
 * Scout. The desk on screen can add its own (`useDeskCommands`).
 *
 * Not a dialog and not a window: the bar opens. While the palette is open the
 * field takes the desk tabs' place in the bar (`PaletteBar`, which the bar
 * renders) and the results unroll under the bar, edge to edge. Esc, a press
 * anywhere else, focus leaving it or a command run give the tabs back. Nothing
 * of it is on screen otherwise. This component is the key alone.
 */
export function CommandPalette() {
  const setOpen = usePalette((s) => s.setOpen);
  const toggle = usePalette((s) => s.toggle);
  const pathname = usePathname();

  // ⌘K (Ctrl+K elsewhere) from anywhere, a field included: the one key every
  // desk leaves alone. Captured, so a field that keeps its keys cannot keep this one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.repeat) return;
      if (e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [toggle]);

  // A new page brings its own bar; the field does not carry over to it.
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  return null;
}

/** The palette in the bar, where the desk tabs were: the field, the drawer under it, and what puts it away. */
export function PaletteBar() {
  const setOpen = usePalette((s) => s.setOpen);
  const close = useCallback(() => setOpen(false), [setOpen]);
  const root = useRef<HTMLDivElement>(null);

  // Focus goes back where it was when the tabs come back.
  useEffect(() => {
    const before = document.activeElement;
    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus();
    };
  }, []);

  // A press anywhere else lets go.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close();
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [close]);

  return (
    <div
      ref={root}
      className={dk.palette}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        close();
      }}
      // Focus leaving the palette (a Tab out, a click on a control elsewhere) closes it.
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node | null)) close();
      }}
      // A press on a row or the foot keeps the focus in the field, so the row's click still lands.
      onMouseDown={(e) => {
        if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
      }}
    >
      <PaletteBody close={close} />
    </div>
  );
}

function PaletteBody({ close }: { close: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  // The body mounts on open, in the browser: the demo flag is read off the URL once, as the bar's links use it.
  const [demo] = useState(() => isDeskDemo(window.location.pathname, new URLSearchParams(window.location.search)));
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const theme = useDeskTheme((s) => s.theme);
  const setTheme = useDeskTheme((s) => s.setTheme);
  const toggleTheme = useDeskTheme((s) => s.toggle);
  const selectedTeam = useUIStore((s) => s.selectedTeam);
  const setSelectedTeam = useUIStore((s) => s.setSelectedTeam);
  const teams = useTeamsQuery();
  const deskCommands = usePalette((s) => s.desk);

  const [q, setQ] = useState("");
  const wanted = q.trim().length >= 2 ? q.trim() : "";
  const asked = useDebouncedValue(wanted, DIRECTORY_DEBOUNCE_MS);
  const directory = usePlayerSearchQuery(asked);
  const searching = wanted !== "" && (wanted !== asked || directory.isFetching);
  const players = wanted ? directoryMatches(directory.data, q).slice(0, 6) : [];
  const nbaTeams = useMemo(() => matchTeams(q, 4), [q]);

  const commands = useMemo<PaletteCommand[]>(() => {
    const here = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
    const deskHref = (href: string) => (demo ? `${href}?demo` : href);
    const go = (href: string) => () => router.push(href);
    const out: PaletteCommand[] = Object.values(deskCommands).flat();

    for (const d of ALL_DESKS) {
      const Icon = DESK_ICONS[d.id];
      out.push({ id: `desk-${d.id}`, label: d.label, note: d.note, icon: <Icon size={14} />, group: "Desks", keywords: d.keywords, on: here(d.href), run: go(deskHref(d.href)) });
    }
    for (const l of LENSES) {
      const Icon = LENS_ICONS[l.id];
      out.push({
        id: `scout-${l.id}`,
        label: l.overview,
        note: l.overviewNote,
        icon: <Icon size={14} />,
        group: "Scout",
        keywords: ["scout", l.id, l.label],
        run: go(`${SCOUT_DESK}${focusToSearch({ kind: "overview", lens: l.id })}`),
      });
    }
    if (isSignedIn && !demo) {
      for (const t of teams.data ?? []) {
        out.push({
          id: `team-${t.team_id}`,
          label: teamName(t),
          note: teamTag(t),
          icon: <Users size={14} />,
          group: "Teams",
          keywords: ["team", "switch", leagueName(t.league?.name ?? t.league_info?.league_name, t.league_info?.league_id)],
          on: t.team_id === selectedTeam,
          run: () => {
            setSelectedTeam(t.team_id);
            // The team's desk is Week; the pick shows there, not on the desk left behind.
            if (!here(WEEK_DESK)) router.push(WEEK_DESK);
          },
        });
      }
    }
    const pair = DESK_THEMES.find((t) => t.id === themePair(theme));
    out.push({
      id: "theme-swap",
      label: "Swap light and dark",
      note: pair ? `To ${pair.label}` : undefined,
      icon: <SunMoon size={14} />,
      keys: "T",
      group: "Theme",
      keywords: ["theme", "appearance", "dark", "light", "mode"],
      run: toggleTheme,
    });
    for (const t of DESK_THEMES) {
      out.push({ id: `theme-${t.id}`, label: t.label, note: t.note, icon: <Palette size={14} />, group: "Theme", keywords: ["theme", "appearance", t.scheme], on: t.id === theme, run: () => setTheme(t.id) });
    }
    if (isSignedIn) {
      // On the Account desk itself these are its own keys and rows.
      if (!here(ACCOUNT_DESK)) {
        out.push({
          id: "account-add",
          label: "Add a team…",
          note: "An ESPN or Yahoo team, on the Account desk",
          icon: <Plus size={14} />,
          group: "Account",
          keywords: ["team", "add", "connect", "espn", "yahoo", "league"],
          run: go(`${ACCOUNT_DESK}?add`),
        });
        out.push({
          id: "account-teams",
          label: "Teams and connections",
          note: "Your teams, the accounts they read through, alerts",
          icon: <ArrowUpRight size={14} />,
          group: "Account",
          keywords: ["account", "teams", "connections", "settings", "alerts", "manage"],
          run: go(ACCOUNT_DESK),
        });
      }
      out.push({ id: "account-sign-out", label: "Sign out", icon: <LogOut size={14} />, group: "Account", keywords: ["sign out", "log out", "logout", "exit"], run: () => void signOut({ redirectUrl: "/" }) });
    } else {
      out.push({ id: "account-sign-in", label: "Sign in", note: "Your teams, your week", icon: <LogIn size={14} />, group: "Account", keywords: ["sign in", "log in", "login", "account"], run: go("/sign-in") });
    }
    return out;
  }, [deskCommands, pathname, demo, router, isSignedIn, teams.data, selectedTeam, setSelectedTeam, theme, setTheme, toggleTheme, signOut]);

  const order = useMemo(() => [...new Set([...Object.values(deskCommands).flat().map((c) => c.group), ...GROUP_ORDER])], [deskCommands]);
  const groups = useMemo(() => groupMatches(q, commands, order), [q, commands, order]);
  // What you typed the name of comes first; the players and NBA teams found by name follow it, before anything matched by a keyword.
  const before = groups.filter((g) => g.best === 0);
  const after = groups.filter((g) => g.best > 0);
  const nothing = !searching && groups.length === 0 && players.length === 0 && nbaTeams.length === 0;

  const run = (c: PaletteCommand) => {
    close();
    c.run();
  };
  const openInScout = (search: string) => {
    close();
    router.push(`${SCOUT_DESK}${search}`);
  };
  const heading = (label: string) => <span className={`${dk.label} ${dk.menuGroupLabel}`}>{label}</span>;

  return (
    <Command label="Search and commands" shouldFilter={false} loop className={dk.paletteCmd}>
      <div className={dk.paletteHead}>
        <Search size={15} className={dk.paletteSearchIcon} />
        <Command.Input
          className={dk.paletteInput}
          value={q}
          onValueChange={setQ}
          placeholder="A desk, a player, a team, a theme…"
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
        <span className={`${dk.kbd} ${dk.paletteEsc}`}>esc</span>
      </div>
      <div className={dk.paletteDrawer}>
        <Command.List className={q ? dk.paletteList : `${dk.paletteList} ${dk.paletteBrowse}`}>
          {before.map((g) => (
            <CommandGroup key={g.group} group={g} heading={heading} run={run} />
          ))}
          {players.length ? (
            <Command.Group heading={heading("Players")}>
              {players.map((p) => (
                <Command.Item key={`player-${p.id}`} value={`player-${p.id}`} className={dk.menuItem} onSelect={() => openInScout(focusToSearch({ kind: "player", id: p.id }))}>
                  <Headshot nbaId={p.id} name={p.name} size={22} />
                  <span className={dk.paletteText}>
                    <span className={dk.paletteLabel}>{p.name}</span>
                    <span className={`${dk.sub} ${dk.paletteNote}`}>
                      {p.team ?? "FA"}
                      {p.position ? ` · ${p.position}` : ""}
                    </span>
                  </span>
                  <span className={dk.sub}>Scout</span>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}
          {nbaTeams.length ? (
            <Command.Group heading={heading("NBA teams")}>
              {nbaTeams.map((t) => (
                <Command.Item key={`nba-${t.abbrev}`} value={`nba-${t.abbrev}`} className={dk.menuItem} onSelect={() => openInScout(focusToSearch({ kind: "team", abbrev: t.abbrev }))}>
                  <TeamLogo abbrev={t.abbrev} size={20} />
                  <span className={dk.paletteText}>
                    <span className={dk.paletteLabel}>{t.name}</span>
                    <span className={`${dk.sub} ${dk.paletteNote}`}>
                      {t.conference} · {t.division}
                    </span>
                  </span>
                  <span className={dk.sub}>Scout</span>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}
          {after.map((g) => (
            <CommandGroup key={g.group} group={g} heading={heading} run={run} />
          ))}
          {searching && players.length === 0 ? <div className={dk.menuEmpty}>Searching the directory…</div> : null}
          {nothing ? <div className={dk.menuEmpty}>Nothing for “{q}”. Try a desk, a player, an NBA team or a theme.</div> : null}
        </Command.List>
        <div className={dk.paletteFoot}>
          <span>
            <span className={dk.kbd}>↑↓</span> move
          </span>
          <span>
            <span className={dk.kbd}>⏎</span> run
          </span>
          <span>
            <span className={dk.kbd}>esc</span> close
          </span>
          <span className={dk.spacer} />
          <span>Players and NBA teams open in Scout</span>
        </div>
      </div>
    </Command>
  );
}

function CommandGroup({ group, heading, run }: { group: PaletteGroup<PaletteCommand>; heading: (label: string) => React.ReactNode; run: (c: PaletteCommand) => void }) {
  return (
    <Command.Group heading={heading(group.group)}>
      {group.entries.map((c) => (
        <CommandRow key={c.id} command={c} onSelect={() => run(c)} />
      ))}
    </Command.Group>
  );
}

function CommandRow({ command: c, onSelect }: { command: PaletteCommand; onSelect: () => void }) {
  return (
    <Command.Item value={c.id} className={dk.menuItem} onSelect={onSelect}>
      <span className={dk.paletteIcon}>{c.icon}</span>
      <span className={dk.paletteText}>
        <span className={dk.paletteLabel}>{c.label}</span>
        {c.note ? <span className={`${dk.sub} ${dk.paletteNote}`}>{c.note}</span> : null}
      </span>
      {c.keys ? <span className={dk.kbd}>{c.keys}</span> : null}
      {c.on ? <Check size={13} className={dk.chev} /> : null}
    </Command.Item>
  );
}
