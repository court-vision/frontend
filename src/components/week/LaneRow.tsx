"use client";

import { Fragment } from "react";
import * as Popover from "@radix-ui/react-popover";
import { History, Mail, MonitorSmartphone, Pause, Play, Square } from "lucide-react";
import type { LaneCell } from "@/lib/lanes";
import type { WeekDay } from "@/lib/week-grid";
import type { StreamLane } from "@/types/stream-lane";
import { Headshot } from "@/components/desk/Headshot";
import { pts, shortName } from "./format";
import dk from "@/components/desk/desk.module.css";
import s from "./week.module.css";

/** What the daily view needs to draw the open lane and act on it. */
export interface LaneRowModel {
  lane: StreamLane;
  /** Per day of the week (null outside the lane's days). */
  cells: Array<LaneCell | null>;
  /** "+18.4 projected · 3 adds left · as of Tue 3:05 PM", or why it's paused. */
  summary: string;
  /** History, newest first, in words. */
  history: string[];
  busy: boolean;
  container: HTMLElement | null;
  /** Hovering the lane previews its projection in the grid. */
  onPreview: (on: boolean) => void;
  onPause: () => void;
  onResume: () => void;
  onNotify: (mode: StreamLane["notify"]) => void;
  onStop: () => void;
}

const TAG: Record<LaneCell["state"], string> = {
  made: "ADDED",
  scheduled: "PICKING UP",
  failed: "NOT MADE",
  kept: "KEPT",
  missed: "MISSED",
  projected: "",
};

export function LaneGroupRow({ model }: { model: LaneRowModel }) {
  const { lane, busy } = model;
  const active = lane.status === "active";
  return (
    <div className={s.groupRow} role="presentation" data-group="lane">
      <div className={s.groupLabel}>
        <span className={dk.label} style={{ color: "var(--accent)" }}>
          Stream
        </span>
      </div>
      <div className={`${s.groupFill} ${s.laneHead}`}>
        <span className={`${dk.sub} ${s.laneSummary}`}>
          {shortName(lane.holder.name)}&apos;s spot · {model.summary}
        </span>
        <span className={s.laneControls}>
          <button
            type="button"
            className={s.laneBtn}
            disabled={busy}
            onClick={() => model.onNotify(lane.notify === "email" ? "desk" : "email")}
            title={lane.notify === "email" ? "Emails you each move; click for desk only" : "Desk only; click to get emails"}
          >
            {lane.notify === "email" ? <Mail size={12} /> : <MonitorSmartphone size={12} />}
            {lane.notify === "email" ? "Email" : "Desk only"}
          </button>
          <Popover.Root>
            <Popover.Trigger asChild>
              <button type="button" className={s.laneBtn} title="What the lane has done">
                <History size={12} />
                History
              </button>
            </Popover.Trigger>
            <Popover.Portal container={model.container}>
              <Popover.Content className={`${dk.menu} ${dk.menuWide}`} side="bottom" align="end" sideOffset={6} collisionPadding={12}>
                <div className={dk.menuHead}>
                  <span className={dk.menuTitle}>Stream lane history</span>
                </div>
                <div className={s.laneHistory}>
                  {model.history.length === 0 ? <div className={dk.menuEmpty}>Nothing yet.</div> : null}
                  {model.history.map((line, i) => (
                    <div key={i} className={s.laneHistoryLine}>
                      {line}
                    </div>
                  ))}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          {active ? (
            <button type="button" className={s.laneBtn} disabled={busy} onClick={model.onPause} title="Stop deciding until you resume">
              <Pause size={12} />
              Pause
            </button>
          ) : (
            <button type="button" className={s.laneBtn} disabled={busy} onClick={model.onResume} title="Decide again from the next open day">
              <Play size={12} />
              Resume
            </button>
          )}
          <button type="button" className={`${s.laneBtn} ${s.laneStop}`} disabled={busy} onClick={model.onStop} title="End the lane">
            <Square size={11} />
            Stop
          </button>
        </span>
      </div>
    </div>
  );
}

export function LaneRow({
  model,
  days,
  focusDay,
  todayIndex,
}: {
  model: LaneRowModel;
  days: WeekDay[];
  focusDay: number | null;
  todayIndex: number | null;
}) {
  const { lane, cells } = model;
  const previewable = lane.status === "active" && !!lane.projection;
  return (
    <div
      className={s.row}
      role="row"
      data-group="lane"
      data-status={lane.status}
      onMouseEnter={() => previewable && model.onPreview(true)}
      onMouseLeave={() => previewable && model.onPreview(false)}
    >
      <div className={s.slotCell} role="rowheader">
        <span className={s.slotChip} data-group="lane">
          LANE
        </span>
      </div>
      {days.map((d, i) => {
        const cell = cells[i];
        const focused = i === focusDay;
        const today = d.index === todayIndex;
        const title = cell
          ? [cell.player.name, cell.state === "projected" ? "projected" : TAG[cell.state].toLowerCase(), cell.note].filter(Boolean).join(" · ")
          : undefined;
        return (
          <Fragment key={d.date}>
            <div
              className={s.laneCell}
              role="gridcell"
              data-state={cell?.state}
              data-switch={cell?.switch ?? false}
              data-today={today}
              title={title}
            >
              {cell ? (
                <>
                  {focused ? <Headshot nbaId={cell.player.nba_player_id ?? null} name={cell.player.name} size={22} /> : null}
                  <span className={s.laneName}>{focused ? cell.player.name : shortName(cell.player.name)}</span>
                </>
              ) : null}
            </div>
            <div className={focused ? s.pickupStat : s.pickupValue} role="gridcell" data-today={today}>
              {cell ? (
                cell.state === "projected" ? (
                  <span className={s.laneValue}>{cell.value != null && cell.value > 0 ? `+${pts(cell.value)}` : ""}</span>
                ) : (
                  <span className={s.laneTag} data-state={cell.state}>
                    {focused && cell.note ? cell.note : TAG[cell.state]}
                  </span>
                )
              ) : null}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
