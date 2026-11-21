"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Loader2, Maximize2, MessageSquare, Minimize2, Play, X } from "lucide-react";
import { toast } from "sonner";
import { useNow } from "@/components/account/blocks";
import { SegRail } from "@/components/desk/SegRail";
import type { DeskTeam } from "@/components/desk/TeamSwitch";
import { aiMessage, useAiDecisionVerdict, useAiNotesQuery, useAiTimelineQuery, useRunAiCheckin } from "@/hooks/useAi";
import { useViewerZone } from "@/hooks/useViewerZone";
import { actionLine } from "@/lib/ai-autonomy";
import { AREA_LABEL, eventsShown, KIND_LABEL } from "@/lib/ai-checkins";
import { PANE_LABEL, type AiPaneView } from "@/lib/ai-desk";
import { callResult, checkinTitle, dayLabel, didChip, KIND_LETTER, planNote, shiftDay, SLOT_NOTE, stateLine, timelineRows } from "@/lib/ai-timeline";
import { WINDOW_LABELS, kindLabel } from "@/lib/dime";
import { localClock, localizeProseClocks } from "@/lib/local-time";
import type { AiCheckinSlot, AiNote, AiTimelineCall, AiTimelineCheckin, AiVerdict } from "@/types/ai";
import { DimeMemory } from "./DimeNotes";
import { MoveResults } from "./MoveLedger";
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

const VIEWS: AiPaneView[] = ["timeline", "notebook", "results"];
/** With check-ins off there is no timeline: the pane opens only for the Notebook or the results. */
const NO_TIMELINE: AiPaneView[] = ["notebook", "results"];

/**
 * The AI desk's left pane: the team's day on a timeline (the Dime desk redesign, step 1), with
 * Dime's plan on top; or its Notebook (every note Dime keeps); or how its moves went. A check-in
 * on the timeline shows what Dime thought (each call and why), what it did (sent or held back,
 * and how a sent move went) and what it noted; opening it puts its conversation in the chat pane.
 */
export function TimelinePane({
  teamId,
  teams,
  hasTimeline,
  paused,
  settingsHref,
  view,
  onView,
  day,
  onDay,
  current,
  onOpen,
  expanded,
  onExpand,
  onChat,
  onClose,
}: {
  teamId: number | null;
  teams: DeskTeam[];
  /** The team's check-ins are on (or paused over something at AI): its day has a timeline. */
  hasTimeline: boolean;
  /** Why no check-in is scheduled on the team, while they are paused. */
  paused: string | null;
  /** Where the team's automations and check-ins are set. */
  settingsHref: string;
  view: AiPaneView;
  onView: (view: AiPaneView) => void;
  /** The fantasy day shown, YYYY-MM-DD; null for today. */
  day: string | null;
  onDay: (day: string | null) => void;
  /** The conversation open in the chat pane. */
  current: number | null;
  onOpen: (conversationId: number) => void;
  expanded: boolean;
  onExpand: () => void;
  /** Narrow screens show one pane at a time: back to the chat. */
  onChat: () => void;
  /** Without a timeline: close the pane, leaving the chat alone. */
  onClose: () => void;
}) {
  const views = hasTimeline ? VIEWS : NO_TIMELINE;
  return (
    <section className={`${s.pane} ${s.timelinePane}`} aria-label="Timeline">
      <header className={s.paneHead}>
        <SegRail label="What this pane shows" active={view}>
          {views.map((v) => {
            const on = view === v;
            return (
              <button key={v} type="button" role="radio" aria-checked={on} className={`${dk.seg} ${on ? dk.segOn : ""}`} onClick={() => onView(v)}>
                <span className={dk.segLabel}>{v === "results" ? "Results" : PANE_LABEL[v]}</span>
              </button>
            );
          })}
        </SegRail>
        <span className={dk.spacer} />
        <button type="button" className={`${dk.btn} ${dk.btnSmall} ${s.narrowOnly}`} onClick={onChat}>
          <MessageSquare size={12} /> Chat
        </button>
        <button
          type="button"
          className={`${dk.iconBtn} ${s.wideOnly}`}
          aria-label={expanded ? "Show the chat beside it" : "Expand this pane"}
          title={expanded ? "Show the chat beside it (E)" : "Expand this pane (E)"}
          onClick={onExpand}
        >
          {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
        {hasTimeline ? null : (
          <button type="button" className={`${dk.iconBtn} ${s.wideOnly}`} aria-label="Close this pane" title="Close this pane" onClick={onClose}>
            <X size={13} />
          </button>
        )}
      </header>
      {view === "notebook" ? (
        <DimeMemory teams={teams} teamId={teamId} teamSwitch={null} />
      ) : view === "results" ? (
        <MoveResults teams={teams} teamId={teamId} teamSwitch={null} />
      ) : (
        <DayView
          teamId={teamId}
          paused={paused}
          settingsHref={settingsHref}
          day={day}
          onDay={onDay}
          current={current}
          onOpen={onOpen}
          onNotebook={() => onView("notebook")}
        />
      )}
    </section>
  );
}

function DayView({
  teamId,
  paused,
  settingsHref,
  day,
  onDay,
  current,
  onOpen,
  onNotebook,
}: {
  teamId: number | null;
  paused: string | null;
  settingsHref: string;
  day: string | null;
  onDay: (day: string | null) => void;
  current: number | null;
  onOpen: (conversationId: number) => void;
  onNotebook: () => void;
}) {
  const query = useAiTimelineQuery(teamId, day, true);
  const notes = useAiNotesQuery(true, false);
  const run = useRunAiCheckin();
  const tz = useViewerZone();
  // The Now line moves on its own
  const now = useNow(30_000);
  const data = query.data;
  const today = data?.today ?? null;
  const shown = data?.date ?? day;
  const plan = planNote(notes.data, teamId);
  const isToday = !!data && data.date === data.today;
  const running = data?.checkins.some((c) => c.state === "running") ?? false;
  const canNext = !!data && !!today && data.date <= today;
  const go = (n: number) => {
    if (!shown || !today || (n > 0 && !canNext)) return;
    const next = shiftDay(shown, n);
    onDay(next === today ? null : next);
  };

  // [ and ] go a day back and on; up and down walk the check-ins, Enter opens one in the chat
  const scroll = useRef<HTMLDivElement>(null);
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = scroll.current;
      // Not while the pane is hidden (the chat expanded, or a phone showing the chat)
      if (!el || el.offsetParent === null || e.metaKey || e.ctrlKey || e.altKey) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName))) return;
      if (active?.closest('[role="dialog"], [data-radix-popper-content-wrapper]')) return;
      if (e.key === "[" || e.key === "]") {
        e.preventDefault();
        goRef.current(e.key === "[" ? -1 : 1);
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      // Only from the timeline itself, or from nowhere in particular
      if (active && active !== document.body && !el.contains(active)) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>("[data-tl-item]"));
      if (!items.length) return;
      e.preventDefault();
      const at = active ? items.indexOf(active) : -1;
      const down = e.key === "ArrowDown";
      const next = at < 0 ? (down ? 0 : items.length - 1) : Math.min(items.length - 1, Math.max(0, at + (down ? 1 : -1)));
      items[next].focus();
      items[next].scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  let body: React.ReactNode;
  if (teamId == null) {
    body = <div className={s.tlEmpty}>Add a team and its day shows here.</div>;
  } else if (query.isLoading) {
    body = (
      <div className={s.tlEmpty} aria-busy>
        <span className={dk.skel} style={{ width: "70%" }} />
        <span className={dk.skel} style={{ width: "90%" }} />
        <span className={dk.skel} style={{ width: "50%" }} />
      </div>
    );
  } else if (query.isError || !data) {
    body = (
      <div className={s.tlEmpty}>
        {aiMessage(query.error, "Couldn't read the day")}{" "}
        <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );
  } else {
    const rows = timelineRows(data, now);
    body = (
      <>
        {data.notes_due.length ? <NotesDue notes={data.notes_due} /> : null}
        {rows.length === 0 ? (
          <div className={s.tlEmpty}>
            {data.date < data.today ? "Dime ran no check-ins this day." : data.checkins_on ? "Nothing is scheduled this day: no games." : "Nothing ran this day."}
          </div>
        ) : (
          <ol className={s.tl}>
            {rows.map((row) => {
              const when = localClock(row.at, { tz });
              if (row.kind === "now") {
                return (
                  <li key="now" className={s.tlNow}>
                    <span>NOW {when}</span>
                    <span className={s.tlNowLine} />
                  </li>
                );
              }
              if (row.kind === "tip") {
                return (
                  <li key="tip" className={s.tlRow} data-kind="tip">
                    <span className={s.tlWhen}>{when}</span>
                    <span className={s.tlMark}>First tip · players lock as they tip</span>
                  </li>
                );
              }
              if (row.kind === "upcoming") {
                return (
                  <li key={`slot-${row.slot.kind}-${row.slot.date}`} className={s.tlRow} data-kind="upcoming">
                    <span className={s.tlWhen}>{when}</span>
                    <Upcoming slot={row.slot} />
                  </li>
                );
              }
              return (
                <li key={row.checkin.checkin_id} className={s.tlRow} data-kind="checkin">
                  <span className={s.tlWhen}>{when}</span>
                  <CheckinItem checkin={row.checkin} day={data.date} current={current} onOpen={onOpen} />
                </li>
              );
            })}
          </ol>
        )}
      </>
    );
  }

  return (
    <div className={s.tlBody}>
      <div className={s.dayBar}>
        <button type="button" className={dk.iconBtn} aria-label="The day before" title="The day before ([)" disabled={!data} onClick={() => go(-1)}>
          <ChevronLeft size={14} />
        </button>
        <span className={s.dayLabel}>{shown && today ? dayLabel(shown, today) : "Today"}</span>
        <button
          type="button"
          className={dk.iconBtn}
          aria-label="The day after"
          title="The day after (])"
          disabled={!canNext}
          onClick={() => go(1)}
        >
          <ChevronRight size={14} />
        </button>
        {day != null ? (
          <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => onDay(null)}>
            Today
          </button>
        ) : null}
        <span className={dk.spacer} />
        {isToday && data?.checkins_on && teamId != null ? (
          <button
            type="button"
            className={`${dk.btn} ${dk.btnSmall}`}
            disabled={running || run.isPending}
            title={running ? "A check-in is running on this team" : "Run a check-in now, off the schedule: morning, pre-lock or night by the clock"}
            onClick={() =>
              run.mutate(
                { teamId },
                {
                  onSuccess: () => toast.success("Dime is on it. The check-in lands on the timeline when it finishes."),
                  onError: (err) => toast.error(aiMessage(err, "Couldn't start the check-in")),
                }
              )
            }
          >
            {run.isPending ? <Loader2 size={12} className={dk.spin} /> : <Play size={12} />} Run now
          </button>
        ) : null}
      </div>
      <div ref={scroll} className={s.tlScroll}>
        {paused ? (
          <div className={s.tlDue}>
            <span>{paused}. No scheduled check-ins until you resume them.</span>
            <Link href={settingsHref} className={dk.link}>
              Resume in AI and automation
            </Link>
          </div>
        ) : null}
        {plan ? <PlanStrip note={plan} onNotebook={onNotebook} /> : null}
        {body}
      </div>
    </div>
  );
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}

/** Dime's plan for the team, its newest plan note, on top of the day (memory option 1). */
function PlanStrip({ note, onNotebook }: { note: AiNote; onNotebook: () => void }) {
  return (
    <div className={s.plan} aria-label="Dime's plan">
      <div className={s.planHead}>
        <span className={dk.label}>{note.author === "user" ? "Your plan" : "Dime's plan"}</span>
        <span className={dk.sub}>since {shortDate(note.written_on)}</span>
        {note.recheck_on ? <span className={dk.sub}>· recheck {shortDate(note.recheck_on)}</span> : null}
        <span className={dk.spacer} />
        <button type="button" className={dk.ghost} onClick={onNotebook}>
          Notebook
        </button>
      </div>
      <p className={s.planText}>{note.text}</p>
    </div>
  );
}

function NotesDue({ notes }: { notes: AiNote[] }) {
  return (
    <div className={s.tlDue} aria-label="Notes due this day">
      <span className={dk.label}>Due to recheck</span>
      {notes.map((n) => (
        <span key={n.note_id} className={s.tlDueRow}>
          <span className={s.tlLabel}>{kindLabel(n.kind)}</span> {n.text}
        </span>
      ))}
    </div>
  );
}

function Upcoming({ slot }: { slot: AiCheckinSlot }) {
  return (
    <div className={s.tlItem} data-plan="">
      <div className={s.tlHeadStatic}>
        <span className={s.tlKind} data-plan="">
          {KIND_LETTER[slot.kind]}
        </span>
        <span className={s.tlTitle}>{KIND_LABEL[slot.kind]}</span>
        <span className={dk.spacer} />
        <span className={dk.sub}>scheduled</span>
      </div>
      <span className={s.tlFaint}>{SLOT_NOTE[slot.kind]}</span>
    </div>
  );
}

function CheckinItem({
  checkin: c,
  day,
  current,
  onOpen,
}: {
  checkin: AiTimelineCheckin;
  day: string;
  current: number | null;
  onOpen: (conversationId: number) => void;
}) {
  const { title, about } = checkinTitle(c, day);
  const did = didChip(c);
  const line = stateLine(c);
  const opens = c.conversation_id != null && c.state !== "running";
  const isOpen = c.conversation_id != null && c.conversation_id === current;
  const { shown: events, more } = eventsShown(c);
  const open = () => {
    if (opens) onOpen(c.conversation_id!);
  };
  const head = (
    <>
      <span className={s.tlKind}>{KIND_LETTER[c.kind]}</span>
      <span className={s.tlTitle}>{title}</span>
      {about ? <span className={dk.sub}>{about}</span> : null}
      {c.manual ? <span className={dk.sub}>· run by you</span> : null}
      <span className={dk.spacer} />
      {c.cost_usd > 0 ? <span className={dk.sub}>{c.cost_usd < 0.01 ? "<$0.01" : `$${c.cost_usd.toFixed(2)}`}</span> : null}
      <span className={`${dk.chip} ${did.tone === "warn" ? dk.warnChip : dk[did.tone]}`}>
        {c.state === "running" ? <Loader2 size={10} className={dk.spin} style={{ marginRight: 4 }} /> : null}
        {did.text}
      </span>
    </>
  );
  return (
    <div
      className={s.tlItem}
      aria-current={isOpen ? "true" : undefined}
      data-state={c.state}
      onClick={(e) => {
        // The calls' own buttons (agree, disagree) do their own thing
        if ((e.target as HTMLElement).closest("button, a")) return;
        open();
      }}
    >
      {opens ? (
        <button type="button" className={s.tlHead} data-tl-item onClick={open} title="Open it in the chat">
          {head}
        </button>
      ) : (
        <div className={s.tlHeadStatic} data-tl-item tabIndex={-1} title={c.state === "running" ? "Dime is working on it; it opens when it finishes" : undefined}>
          {head}
        </div>
      )}
      {line ? <span className={s.tlFaint}>{line}</span> : null}
      {events.length ? (
        <div className={s.tlNotes}>
          <span className={s.tlLabel}>Came in</span>
          {events.map((e, i) => (
            <span key={`${e.source}-${e.player_id}-${i}`}>{e.summary}</span>
          ))}
          {more ? <span className={s.tlFaint}>and {more} more</span> : null}
        </div>
      ) : null}
      {c.calls.length ? (
        <div className={s.tlCalls}>
          {c.calls.map((call) => (
            <Call key={call.decision_id} call={call} conversationId={c.conversation_id ?? null} date={c.date} />
          ))}
        </div>
      ) : null}
      {c.notes.length ? (
        <div className={s.tlNotes}>
          <span className={s.tlLabel}>Noted</span>
          {c.notes.map((n) => (
            <span key={n.note_id} data-retired={n.retired_on ? "" : undefined}>
              <span className={s.tlLabel}>{kindLabel(n.kind)}</span> {n.text}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** One call: what Dime thought and why, what it did about it, how it went, and your agree or disagree. */
function Call({ call, conversationId, date }: { call: AiTimelineCall; conversationId: number | null; date: string }) {
  const verdict = useAiDecisionVerdict(conversationId);
  // Shown at once; the timeline is read again when the save settles
  const [mine, setMine] = useState<AiVerdict | null | undefined>(undefined);
  const shown = mine !== undefined ? mine : (call.verdict ?? null);
  const tz = useViewerZone();
  const result = callResult(call);
  const set = (v: AiVerdict) => {
    const next = shown === v ? null : v;
    setMine(next);
    verdict.mutate(
      { decisionId: call.decision_id, verdict: next },
      {
        onError: (err) => {
          setMine(undefined);
          toast.error(aiMessage(err, "Couldn't save that"));
        },
      }
    );
  };
  const action = call.action ? actionLine(call.action) : null;
  return (
    <div className={s.tlCall} data-call={call.call}>
      <span className={s.tlTag} data-call={call.call} title={AREA_LABEL[call.area]}>
        {call.call === "hold" ? "HOLD" : "CHANGE"}
      </span>
      <div className={s.tlCallText}>
        <span className={s.tlSummary}>{localizeProseClocks(call.summary, date, { tz })}</span>
        <span className={s.tlReason}>{localizeProseClocks(call.reason, date, { tz })}</span>
        {action ? (
          <span className={s.tlAction} data-outcome={call.action!.outcome}>
            {action.label}: {action.text}
          </span>
        ) : call.call === "change" ? (
          <span className={s.tlAction}>A review: what Dime would do. Its row isn&apos;t at AI, so nothing was sent.</span>
        ) : null}
      </div>
      <div className={s.tlSide}>
        {result ? (
          <span
            className={`${dk.chip} ${dk[result.tone]}`}
            title={`${WINDOW_LABELS[result.window]}${result.open ? ", still being played" : ""}: the added player's points minus the dropped one's`}
            data-open={result.open ? "" : undefined}
          >
            {result.text}
          </span>
        ) : null}
        <button
          type="button"
          className={s.tlVerdict}
          data-verdict="agree"
          aria-pressed={shown === "agree"}
          aria-label="Agree"
          title={shown === "agree" ? "You agree. Click again to clear" : "Agree: you'd have made the same call"}
          onClick={() => set("agree")}
        >
          <Check size={12} strokeWidth={3} />
        </button>
        <button
          type="button"
          className={s.tlVerdict}
          data-verdict="disagree"
          aria-pressed={shown === "disagree"}
          aria-label="Disagree"
          title={shown === "disagree" ? "You disagree. Click again to clear" : "Disagree: you wouldn't have"}
          onClick={() => set("disagree")}
        >
          <X size={12} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
