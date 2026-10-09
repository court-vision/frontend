"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Command } from "cmdk";
import { CalendarDays, Clock, Search } from "lucide-react";
import { Headshot } from "@/components/desk/Headshot";
import { TeamLogo } from "@/components/desk/TeamLogo";
import { usePlayerSearchQuery } from "@/hooks/useScout";
import { dayName, matchPool, matchTeams, parseDateQuery, teamInfo, type Focus } from "@/lib/scout";
import type { RankingsPlayer } from "@/types/rankings";
import dk from "@/components/desk/desk.module.css";
import s from "./scout.module.css";

/** What the box can open: a focus, or a night to expand in the slate's sidebar. */
export type SearchPick = Focus | { kind: "night"; date: string };

export interface SearchBoxProps {
  pool: RankingsPlayer[];
  recent: Focus[];
  today: string;
  onPick: (pick: SearchPick) => void;
  nameOf: (focus: Focus) => string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Tells the toolbar to give the box room. */
  onOpenChange: (open: boolean) => void;
}

/**
 * The toolbar's own search: type, and the matches drop down under the box.
 * Players from the ranked pool first, then the whole directory (rookies, the
 * injured), the thirty teams, and a night ("tonight", "fri", "10/20"). Enter
 * opens the best match; escape lets go.
 */
export function SearchBox({ pool, recent, today, onPick, nameOf, inputRef, onOpenChange }: SearchBoxProps) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const poolHits = useMemo(() => matchPool(q, pool, 6), [q, pool]);
  const teamHits = useMemo(() => matchTeams(q, 4), [q]);
  const date = useMemo(() => parseDateQuery(q, today), [q, today]);
  const directory = usePlayerSearchQuery(open && q.trim().length >= 2 ? q : "");
  const poolIds = useMemo(() => new Set(poolHits.map((p) => p.id)), [poolHits]);
  const directoryHits = (directory.data?.players ?? []).filter((p) => !poolIds.has(p.id)).slice(0, 5);
  const empty = q.trim().length === 0;
  const nothing = !empty && poolHits.length === 0 && teamHits.length === 0 && !date && directoryHits.length === 0 && !directory.isFetching;

  const measure = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom + 6, width: r.width });
  }, [inputRef]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const t = setTimeout(measure, 180); // after the box has grown
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  useEffect(() => onOpenChange(open), [open, onOpenChange]);

  // A click anywhere else lets go.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const pick = (focus: SearchPick) => {
    onPick(focus);
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
  };
  const letGo = () => {
    setOpen(false);
    inputRef.current?.blur();
  };

  const group = (label: string) => <span className={`${dk.label} ${dk.menuGroupLabel}`}>{label}</span>;

  return (
    <div ref={root} className={s.search} data-open={open}>
      <Command label="Find a player, a team, or a night" shouldFilter={false} loop className={s.searchCmd}>
        <Search size={13} className={s.searchIcon} />
        <Command.Input
          ref={inputRef}
          className={s.searchInput}
          value={q}
          onValueChange={(v) => {
            setQ(v);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              if (q) setQ("");
              else letGo();
            }
          }}
          placeholder="Find a player, a team, or a night…"
          aria-label="Find a player, a team, or a night"
          autoComplete="off"
          spellCheck={false}
        />
        {!open ? <span className={`${dk.kbd} ${s.searchKbd}`}>/</span> : null}
        {open && rect ? (
          <div className={s.searchDrop} style={{ left: rect.left, top: rect.top, width: rect.width }} onMouseDown={(e) => e.preventDefault()}>
            <Command.List className={dk.menuList} style={{ maxHeight: "min(440px, 60vh)" }}>
              {empty ? (
                <>
                  <Command.Group heading={group("Go")}>
                    <Command.Item value="go-tonight" className={s.finderItem} onSelect={() => pick({ kind: "overview", lens: "slate" })}>
                      <span className={s.finderKind}>Night</span>
                      <CalendarDays size={14} className={dk.chev} />
                      <span className={dk.grow}>Tonight&apos;s tracker</span>
                      <span className={dk.sub}>{dayName(today, today)}</span>
                    </Command.Item>
                    <Command.Item value="go-standings" className={s.finderItem} onSelect={() => pick({ kind: "overview", lens: "teams" })}>
                      <span className={s.finderKind}>Teams</span>
                      <CalendarDays size={14} className={dk.chev} style={{ visibility: "hidden" }} />
                      <span className={dk.grow}>Standings</span>
                    </Command.Item>
                    <Command.Item value="go-rankings" className={s.finderItem} onSelect={() => pick({ kind: "overview", lens: "pool" })}>
                      <span className={s.finderKind}>Pool</span>
                      <CalendarDays size={14} className={dk.chev} style={{ visibility: "hidden" }} />
                      <span className={dk.grow}>Rankings</span>
                    </Command.Item>
                  </Command.Group>
                  {recent.length ? (
                    <Command.Group heading={group("Recent")}>
                      {recent.slice(0, 8).map((f, i) => (
                        <Command.Item key={`${f.kind}-${i}`} value={`recent-${i}`} className={s.finderItem} onSelect={() => pick(f)}>
                          <span className={s.finderKind}>{f.kind === "player" ? "Player" : f.kind === "team" ? "Team" : f.kind === "game" ? "Game" : f.kind === "market" ? "List" : "View"}</span>
                          {f.kind === "player" ? <Headshot nbaId={f.id} name={nameOf(f)} size={22} /> : f.kind === "team" ? <TeamLogo abbrev={f.abbrev} size={20} /> : <Clock size={14} className={dk.chev} />}
                          <span className={dk.grow}>{nameOf(f)}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}
                </>
              ) : null}
              {date ? (
                <Command.Group heading={group("Night")}>
                  <Command.Item value={`date-${date}`} className={s.finderItem} onSelect={() => pick({ kind: "night", date })}>
                    <span className={s.finderKind}>Night</span>
                    <CalendarDays size={14} className={dk.chev} />
                    <span className={dk.grow}>{dayName(date, today)}</span>
                    <span className={dk.sub}>{date}</span>
                  </Command.Item>
                </Command.Group>
              ) : null}
              {poolHits.length || directoryHits.length ? (
                <Command.Group heading={group("Players")}>
                  {poolHits.map((p) => (
                    <Command.Item key={`pool-${p.id}`} value={`player-${p.id}`} className={s.finderItem} onSelect={() => pick({ kind: "player", id: p.id })}>
                      <span className={s.finderKind}>#{p.rank}</span>
                      <Headshot nbaId={p.id} name={p.player_name} size={22} />
                      <span className={dk.grow}>{p.player_name}</span>
                      <span className={dk.sub}>
                        {p.team}
                        {p.position ? ` · ${p.position}` : ""} · {p.avg_fpts.toFixed(1)}
                      </span>
                    </Command.Item>
                  ))}
                  {directoryHits.map((p) => (
                    <Command.Item key={`dir-${p.id}`} value={`player-${p.id}`} className={s.finderItem} onSelect={() => pick({ kind: "player", id: p.id })}>
                      <span className={s.finderKind}>Dir</span>
                      <Headshot nbaId={p.id} name={p.name} size={22} />
                      <span className={dk.grow}>{p.name}</span>
                      <span className={dk.sub}>
                        {p.team ?? "FA"}
                        {p.position ? ` · ${p.position}` : ""}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {teamHits.length ? (
                <Command.Group heading={group("Teams")}>
                  {teamHits.map((t) => (
                    <Command.Item key={t.abbrev} value={`team-${t.abbrev}`} className={s.finderItem} onSelect={() => pick({ kind: "team", abbrev: t.abbrev })}>
                      <span className={s.finderKind}>{t.abbrev}</span>
                      <TeamLogo abbrev={t.abbrev} size={20} />
                      <span className={dk.grow}>{t.name}</span>
                      <span className={dk.sub}>
                        {t.conference} · {t.division}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {!empty && directory.isFetching && poolHits.length === 0 ? <div className={dk.menuEmpty}>Searching the directory…</div> : null}
              {nothing ? <div className={dk.menuEmpty}>Nothing for “{q}”. Try a surname, a team, or a night like “fri”.</div> : null}
            </Command.List>
            <div className={s.searchFoot}>
              <span>
                <span className={dk.kbd}>↑↓</span> move
              </span>
              <span>
                <span className={dk.kbd}>⏎</span> open
              </span>
              <span>
                <span className={dk.kbd}>esc</span> let go
              </span>
            </div>
          </div>
        ) : null}
      </Command>
    </div>
  );
}

/** A focus's display name when nothing better is known. */
export function fallbackName(focus: Focus, today: string): string {
  switch (focus.kind) {
    case "player":
      return `Player ${focus.id}`;
    case "team":
      return teamInfo(focus.abbrev)?.name ?? focus.abbrev;
    case "game":
      return `${focus.gameId.includes("@") ? focus.gameId.replace("@", " @ ") : "Game"} · ${dayName(focus.date, today)}`;
    case "market":
      return focus.section === "adds" ? "Adds" : focus.section === "drops" ? "Drops" : "Draft market";
    case "overview":
      return focus.lens === "pool" ? "Rankings" : focus.lens === "teams" ? "Standings" : focus.lens === "slate" ? "Tracker" : "Market";
  }
}
