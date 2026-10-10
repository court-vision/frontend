"use client";

import { useState } from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { ArrowUpRight, Check, ChevronDown, Plus } from "lucide-react";
import { ACCOUNT_DESK } from "./routes";
import dk from "./desk.module.css";

/** A team as the bar's switcher shows it. */
export interface DeskTeam {
  id: number;
  name: string;
  /** "ESPN · PTS" */
  tag: string;
  /** Something the team's account needs ("ESPN rejected the cookies"); shown as a dot. */
  warn?: string | null;
}

interface TeamSwitchProps {
  teams: DeskTeam[];
  teamId: number | null;
  onTeam: (id: number) => void;
  /** Opens the add-team flow where the desk is; without it the menu only links to the Account desk. */
  onAdd?: () => void;
  demo?: boolean;
  container: HTMLElement | null;
}

/**
 * The team control every team-scoped desk carries in its bar: which team,
 * the others, and the two doors out of the everyday (add a team, manage
 * teams and connections). A team whose account is in trouble carries a dot
 * here, so the fix is one click from the work.
 */
export function TeamSwitch({ teams, teamId, onTeam, onAdd, demo = false, container }: TeamSwitchProps) {
  const [open, setOpen] = useState(false);
  const team = teams.find((t) => t.id === teamId) ?? null;
  const manageHref = demo ? `${ACCOUNT_DESK}?demo` : ACCOUNT_DESK;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={dk.ghost} aria-label={team ? `Team: ${team.name}` : "Pick a team"}>
          {team?.warn ? <span className={dk.warnDot} title={team.warn} /> : null}
          <span style={{ fontWeight: 500 }}>{team?.name ?? (teams.length ? "Pick a team" : "No team yet")}</span>
          {team ? <span className={dk.sub}>{team.tag}</span> : null}
          <ChevronDown size={14} className={dk.chev} />
        </button>
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content className={dk.menu} align="start" sideOffset={6} style={{ width: 300 }}>
          <div className={dk.menuList}>
            {teams.length ? (
              teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={dk.menuItem}
                  onClick={() => {
                    onTeam(t.id);
                    setOpen(false);
                  }}
                >
                  <span className={dk.grow} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                    {t.warn ? <span className={dk.warnDot} title={t.warn} /> : null}
                  </span>
                  <span className={dk.sub}>{t.tag}</span>
                  {t.id === teamId ? <Check size={13} /> : <span style={{ width: 13 }} />}
                </button>
              ))
            ) : (
              <div className={dk.menuEmpty}>No teams yet. Add one and the desk fills in.</div>
            )}
            <div className={dk.menuSep} />
            {onAdd ? (
              <button
                type="button"
                className={dk.menuItem}
                onClick={() => {
                  setOpen(false);
                  onAdd();
                }}
              >
                <Plus size={13} className={dk.chev} />
                <span className={dk.grow}>Add a team…</span>
              </button>
            ) : null}
            <Link href={manageHref} className={dk.menuItem} onClick={() => setOpen(false)}>
              <ArrowUpRight size={13} className={dk.chev} />
              <span className={dk.grow}>Teams and connections</span>
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
