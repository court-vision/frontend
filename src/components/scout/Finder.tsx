"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { CalendarDays, Clock, User } from "lucide-react";
import { Headshot } from "@/components/desk/Headshot";
import { TeamLogo } from "@/components/desk/TeamLogo";
import { useDeskPortal } from "@/components/desk/DeskFrame";
import { usePlayerSearchQuery } from "@/hooks/useScout";
import { dayName, matchPool, matchTeams, parseDateQuery, teamInfo, type Focus } from "@/lib/scout";
import type { RankingsPlayer } from "@/types/rankings";
import dk from "@/components/desk/desk.module.css";
import s from "./scout.module.css";

interface FinderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pool: RankingsPlayer[];
  recent: Focus[];
  today: string;
  onPick: (focus: Focus) => void;
  /** Names for the recent chips: players by id, from the pool or what the sheet learned. */
  nameOf: (focus: Focus) => string;
}

/**
 * One box that finds anything the desk can open: a player (the ranked pool,
 * then the whole directory for rookies and the injured), an NBA team, or a
 * night ("tonight", "fri", "10/20"). Enter opens the best match.
 */
export function Finder({ open, onOpenChange, pool, recent, today, onPick, nameOf }: FinderProps) {
  const container = useDeskPortal();
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const poolHits = useMemo(() => matchPool(q, pool, 6), [q, pool]);
  const teamHits = useMemo(() => matchTeams(q, 4), [q]);
  const date = useMemo(() => parseDateQuery(q, today), [q, today]);
  const directory = usePlayerSearchQuery(q.trim().length >= 2 ? q : "");
  const poolIds = useMemo(() => new Set(poolHits.map((p) => p.id)), [poolHits]);
  const directoryHits = (directory.data?.players ?? []).filter((p) => !poolIds.has(p.id)).slice(0, 5);
  const empty = q.trim().length === 0;
  const nothing = !empty && poolHits.length === 0 && teamHits.length === 0 && !date && directoryHits.length === 0 && !directory.isFetching;

  const pick = (focus: Focus) => {
    onPick(focus);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className={dk.overlay} />
        <Dialog.Content className={s.finderDialog} aria-describedby={undefined}>
          <Dialog.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>Find</Dialog.Title>
          <Command label="Find a player, team or night" shouldFilter={false} loop>
            <Command.Input
              className={s.finderInput}
              value={q}
              onValueChange={setQ}
              placeholder="A player, a team, or a night — jokic, den, tonight, fri, 10/20"
              autoFocus
            />
            <Command.List className={s.finderList}>
              {empty ? (
                <>
                  <Command.Group heading={<span className={`${dk.label} ${dk.menuGroupLabel}`}>Go</span>}>
                    <Command.Item value="go-tonight" className={s.finderItem} onSelect={() => pick({ kind: "slate", date: today })}>
                      <span className={s.finderKind}>Night</span>
                      <CalendarDays size={14} className={dk.chev} />
                      <span className={dk.grow}>Tonight&apos;s slate</span>
                      <span className={dk.sub}>{dayName(today, today)}</span>
                    </Command.Item>
                    <Command.Item value="go-tomorrow" className={s.finderItem} onSelect={() => pick({ kind: "slate", date: parseDateQuery("tomorrow", today)! })}>
                      <span className={s.finderKind}>Night</span>
                      <CalendarDays size={14} className={dk.chev} />
                      <span className={dk.grow}>Tomorrow&apos;s slate</span>
                    </Command.Item>
                  </Command.Group>
                  {recent.length ? (
                    <Command.Group heading={<span className={`${dk.label} ${dk.menuGroupLabel}`}>Recent</span>}>
                      {recent.slice(0, 8).map((f) => (
                        <Command.Item key={`${f.kind}-${"id" in f ? f.id : "abbrev" in f ? f.abbrev : f.date}`} value={`recent-${JSON.stringify(f)}`} className={s.finderItem} onSelect={() => pick(f)}>
                          <span className={s.finderKind}>{f.kind === "player" ? "Player" : f.kind === "team" ? "Team" : "Night"}</span>
                          {f.kind === "player" ? <Headshot nbaId={f.id} name={nameOf(f)} size={24} /> : f.kind === "team" ? <TeamLogo abbrev={f.abbrev} size={22} /> : <Clock size={14} className={dk.chev} />}
                          <span className={dk.grow}>{nameOf(f)}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}
                </>
              ) : null}
              {date ? (
                <Command.Group heading={<span className={`${dk.label} ${dk.menuGroupLabel}`}>Night</span>}>
                  <Command.Item value={`date-${date}`} className={s.finderItem} onSelect={() => pick({ kind: "slate", date })}>
                    <span className={s.finderKind}>Night</span>
                    <CalendarDays size={14} className={dk.chev} />
                    <span className={dk.grow}>{dayName(date, today)}</span>
                    <span className={dk.sub}>{date}</span>
                  </Command.Item>
                </Command.Group>
              ) : null}
              {poolHits.length || directoryHits.length ? (
                <Command.Group heading={<span className={`${dk.label} ${dk.menuGroupLabel}`}>Players</span>}>
                  {poolHits.map((p) => (
                    <Command.Item key={`pool-${p.id}`} value={`player-${p.id}`} className={s.finderItem} onSelect={() => pick({ kind: "player", id: p.id })}>
                      <span className={s.finderKind}>#{p.rank}</span>
                      <Headshot nbaId={p.id} name={p.player_name} size={24} />
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
                      <Headshot nbaId={p.id} name={p.name} size={24} />
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
                <Command.Group heading={<span className={`${dk.label} ${dk.menuGroupLabel}`}>Teams</span>}>
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
          </Command>
          <div className={s.finderFoot}>
            <span>
              <span className={dk.kbd}>↑↓</span> move
            </span>
            <span>
              <span className={dk.kbd}>⏎</span> open
            </span>
            <span>
              <span className={dk.kbd}>esc</span> close
            </span>
            <span className={dk.spacer} />
            <span>
              <User size={11} /> pool first, then the whole directory
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A focus's display name when nothing better is known. */
export function fallbackName(focus: Focus, today: string): string {
  switch (focus.kind) {
    case "player":
      return `Player ${focus.id}`;
    case "team":
      return teamInfo(focus.abbrev)?.name ?? focus.abbrev;
    case "slate":
      return dayName(focus.date, today);
  }
}

