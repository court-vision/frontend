"use client";

import { useEffect, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Repeat2 } from "lucide-react";
import { slotName } from "@/lib/lineup-editor";
import type { SourcePlayer, WeekDay } from "@/lib/week-grid";
import type { StreamerPlayer } from "@/types/streamer";
import { Headshot } from "./Headshot";
import { pts, signed } from "./format";
import s from "./week.module.css";

interface Anchored {
  anchor: HTMLElement;
  container: HTMLElement | null;
  onClose: () => void;
}

function Shell({ anchor, container, onClose, wide, children }: Anchored & { wide?: boolean; children: React.ReactNode }) {
  return (
    <Popover.Root open onOpenChange={(open) => !open && onClose()}>
      <Popover.Anchor virtualRef={{ current: anchor }} />
      <Popover.Portal container={container}>
        <Popover.Content
          className={`${s.menu} ${wide ? s.menuWide : ""}`}
          side="right"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---------------------------------------------------------------------------
// Move
// ---------------------------------------------------------------------------

export interface MoveTarget {
  slotId: number;
  /** Who swaps back, when the slot is full. */
  partner: string | null;
  /** Change to today's projected total. */
  delta: number;
}

interface MoveMenuProps extends Anchored {
  player: SourcePlayer;
  currentSlot: string;
  targets: MoveTarget[];
  /** Why the lineup can't be edited from here, if it can't. */
  blocked: string | null;
  onPick: (slotId: number) => void;
  onReplace: () => void;
}

export function MoveMenu({ player, currentSlot, targets, blocked, onPick, onReplace, ...shell }: MoveMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <Shell {...shell}>
      <Command ref={ref} loop label={`Move ${player.name}`} style={{ outline: "none" }}>
        <div className={s.menuHead} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Headshot nbaId={player.nbaId} name={player.name} size={34} />
          <span className={s.who}>
            <span className={s.menuTitle}>{player.name}</span>
            <span className={s.sub}>
              {currentSlot} · {player.team} · {pts(player.avg)} proj
            </span>
          </span>
        </div>
        <Command.List className={s.menuList}>
          {blocked ? null : (
            <Command.Group heading={<span className={`${s.label} ${s.menuGroupLabel}`}>Move today to</span>}>
              {targets.length === 0 ? <div className={s.menuEmpty}>No open or swappable slot fits him.</div> : null}
              {targets.map((t) => (
                <Command.Item
                  key={t.slotId}
                  value={`slot-${t.slotId}`}
                  className={s.menuItem}
                  onSelect={() => onPick(t.slotId)}
                >
                  <span className={s.mono} style={{ width: 30, color: "var(--text)" }}>
                    {slotName(t.slotId)}
                  </span>
                  <span className={`${s.grow} ${s.sub}`}>{t.partner ? `swap with ${t.partner}` : "open"}</span>
                  <span className={`${s.chip} ${t.delta > 0.05 ? s.up : t.delta < -0.05 ? s.down : s.flat}`}>
                    {signed(t.delta)}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
          <Command.Item value="replace" className={s.menuItem} onSelect={onReplace}>
            <Repeat2 size={14} style={{ color: "var(--preview)" }} />
            <span className={s.grow}>Replace with a free agent…</span>
            <span className={s.kbd}>R</span>
          </Command.Item>
        </Command.List>
        {blocked ? <div className={s.menuFoot}>{blocked}</div> : null}
      </Command>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Replace
// ---------------------------------------------------------------------------

export interface ReplaceOption {
  fa: StreamerPlayer;
  /** Change to the projected week total if he replaced the player. */
  gain: number;
}

interface ReplaceMenuProps extends Anchored {
  player: SourcePlayer;
  days: WeekDay[];
  options: ReplaceOption[];
  loading: boolean;
  highlighted: number | null;
  onHighlight: (id: number | null) => void;
  onPick: (fa: StreamerPlayer) => void;
}

export function ReplaceMenu({
  player,
  days,
  options,
  loading,
  highlighted,
  onHighlight,
  onPick,
  ...shell
}: ReplaceMenuProps) {
  const upcoming = days.filter((d) => d.kind !== "past");
  return (
    <Shell {...shell} wide>
      <Command
        loop
        label={`Replace ${player.name}`}
        value={highlighted != null ? `fa-${highlighted}` : ""}
        onValueChange={(v) => onHighlight(v.startsWith("fa-") ? Number(v.slice(3)) : null)}
      >
        <div className={s.menuHead}>
          <span className={s.menuTitle}>Replace {player.name}</span>
          <span className={s.sub}>Highlight a free agent to preview his week in the grid · ⏎ to keep it</span>
        </div>
        <Command.Input autoFocus className={s.menuInput} placeholder="Search free agents" />
        <Command.List className={s.menuList}>
          {loading ? <div className={s.menuEmpty}>Loading free agents…</div> : null}
          <Command.Empty className={s.menuEmpty}>No free agent matches.</Command.Empty>
          {options.map(({ fa, gain }) => {
            const playing = new Set(fa.game_days);
            const waivers = fa.acquisition_status === "waivers";
            return (
              <Command.Item
                key={fa.player_id}
                value={`fa-${fa.player_id}`}
                keywords={[fa.name, fa.team, ...fa.valid_positions]}
                className={s.menuItem}
                onSelect={() => onPick(fa)}
              >
                <Headshot nbaId={fa.nba_player_id} name={fa.name} size={28} />
                <span className={s.who}>
                  <span className={s.name}>{fa.name}</span>
                  <span className={s.meta}>
                    {fa.team} · {fa.valid_positions.filter((p) => p.length <= 2 && p !== "UT").join("/")}
                    {waivers ? <span className={`${s.inj} ${s.injSoft}`}>WAIVERS</span> : null}
                    {fa.injury_status ? <span className={s.inj}>{fa.injury_status}</span> : null}
                  </span>
                </span>
                <span className={s.games} title={`${fa.games_remaining} games left`}>
                  {upcoming.map((d) => (
                    <span key={d.index} className={`${s.gameTick} ${playing.has(d.index) ? s.gameTickOn : ""}`} />
                  ))}
                </span>
                <span className={s.mono} style={{ width: 40, textAlign: "right", color: "var(--text-2)" }}>
                  {pts(fa.avg_points_last_n ?? fa.avg_points_season)}
                </span>
                <span
                  className={`${s.chip} ${gain > 0.05 ? s.up : gain < -0.05 ? s.down : s.flat}`}
                  style={{ minWidth: 54, justifyContent: "flex-end" }}
                >
                  {signed(gain)}
                </span>
              </Command.Item>
            );
          })}
        </Command.List>
        <div className={s.menuFoot}>
          Sorted by projected change to your week · bars are his games left · column is his recent average
        </div>
      </Command>
    </Shell>
  );
}
