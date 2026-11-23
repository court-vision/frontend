"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { aiMessage } from "@/hooks/useAi";
import { AI_DESK, DRAFT_DESK } from "@/components/desk/routes";
import { whenTime } from "@/components/week/format";
import { KIND_LABEL } from "@/lib/ai-checkins";
import {
  AUTOPILOT_NOTE,
  ROW_HELP,
  autopilotLive,
  checkinsLabels,
  lineupPrefs,
  pauseLine,
  policyLine,
  prefsTable,
  tableLine,
} from "@/lib/ai-autonomy";
import { effectivePrefs, teamLine, teamName, type AccountFocus } from "@/lib/account";
import type { AiActing, AiAutomationRow, AiAutopilotChange, AiAutopilotTeam, AiFeatures, AiLevel } from "@/types/ai";
import type { DailyActionsLevel, LateScratchLevel, NotificationPreference } from "@/types/notifications";
import type { TeamResponseData } from "@/types/team";
import type { AccountModel } from "./model";
import { Block, Skeleton, Toggle } from "./blocks";
import { LevelRail } from "./LevelRail";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

const ACT_OFF = "Autopilot is switched off on the server for now: no check-in runs and nothing at AI sends until it is back.";

/** How long a team stays in its switch-on moment: the sweep across it, and the rows landing on AI behind it. */
const ENGAGE_MS = 1400;

/**
 * AI and automation's teams: each team folds to one row (its name, the autopilot pill
 * while the switch is on, and its levels in a line) and opens to its whole table, every
 * automation at Off, Notify, Act or AI with the levels it can't do dimmed and saying
 * why, and, on an account with CV AI, the autopilot switch and Dime's check-ins. There
 * is no account-wide table: each team holds its own. Under the teams, Dime's features,
 * which are the account's (they aren't tied to a team).
 */
export function TeamAutomations({
  model,
  expand,
  onOpen,
}: {
  model: AccountModel;
  /** The team to open (the link that led here named it); else the only team, or the one selected. */
  expand?: number;
  onOpen: (focus: AccountFocus) => void;
}) {
  const prefs = model.usePrefs();
  const teamPrefs = model.useTeamPrefs();
  const dime = model.useDime();
  const [open, setOpen] = useState<ReadonlySet<number>>(() => {
    const only = model.teams.length === 1 ? model.teams[0].team_id : null;
    const first = expand ?? only ?? model.selectedTeamId;
    return new Set(first != null ? [first] : []);
  });
  // A later link naming another team opens it too
  const [opened, setOpened] = useState(expand);
  if (opened !== expand) {
    setOpened(expand);
    if (expand != null) setOpen((cur) => new Set([...cur, expand]));
  }
  const toggle = (id: number) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const base = prefs.data;
  const overrides = teamPrefs.data;
  const pilots = dime.data?.teams ?? [];
  const acting = dime.data?.acting ?? null;
  const features = dime.data?.features ?? null;
  const accountEmail = base ? base.lineup_alerts_enabled : true;
  // A card shows a team's real levels only once all three reads are in: the account's values, the team's own,
  // and whether Dime runs it. Until then, or if one fails, no card is editable.
  const loading = prefs.loading || teamPrefs.loading || dime.loading;
  const error = prefs.error ?? teamPrefs.error ?? dime.error;
  const ready = !!base && !!overrides && !loading && !error;
  const retry = () => {
    if (prefs.error) prefs.refetch();
    if (teamPrefs.error) teamPrefs.refetch();
    if (dime.error) dime.refetch();
  };
  const live = pilots.filter((t) => t.autopilot).length;

  return (
    <>
      <Block title="Your teams" note={!ready ? (error ? "" : "loading…") : live ? `${model.teams.length} · autopilot on ${live}` : `${model.teams.length}`}>
        {error ? (
          <div className={s.row2}>
            <span className={s.formError}>Your teams&apos; automations didn&apos;t load: {error}</span>
            <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={retry}>
              Try again
            </button>
          </div>
        ) : !ready || !base || !overrides ? (
          <Skeleton rows={4} />
        ) : model.teams.length === 0 ? (
          <div className={s.blockEmpty}>No teams yet. Add one and its automations show here.</div>
        ) : (
          <div className={s.autoTeams}>
            {model.teams.map((team) => (
              <TeamAutomation
                key={team.team_id}
                model={model}
                team={team}
                prefs={effectivePrefs(base, overrides.find((p) => p.team_id === team.team_id))}
                accountEmail={accountEmail}
                pilot={pilots.find((p) => p.team_id === team.team_id) ?? null}
                acting={acting}
                open={open.has(team.team_id)}
                onToggle={() => toggle(team.team_id)}
              />
            ))}
          </div>
        )}
        {ready && !accountEmail ? (
          <div className={s.row2} style={{ paddingTop: 12 }}>
            <span className={s.fieldHint}>
              Your account&apos;s lineup email is off, so no team&apos;s lineup runs: Lineup can&apos;t be Notify, Act or AI anywhere until it is back on.
            </span>
            <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => onOpen({ kind: "alerts" })}>
              <Bell size={12} /> Open notifications
            </button>
          </div>
        ) : null}
      </Block>
      {features ? <Features features={features} demo={model.demo} onSet={model.setFeatures} /> : null}
    </>
  );
}

function statusLine(t: AiAutopilotTeam): string {
  const paused = pauseLine(t);
  if (paused) return t.paused_by === "system" ? `${paused}. Resume check-ins below and it picks up again.` : "Check-ins are off.";
  return t.next ? `Next check-in: ${KIND_LABEL[t.next.kind].toLowerCase()}, ${whenTime(t.next.due_at)}.` : "No check-in due until the season's next game day.";
}

/** The pill a folded team wears while its autopilot switch is on: the bar's spectrum mark while it runs, else why not. */
function AutopilotPill({ pilot, acting }: { pilot: AiAutopilotTeam; acting: AiActing | null }) {
  if (autopilotLive(pilot, acting)) {
    return (
      <span className={`${dk.badge} ${dk.autopilotMark} ${s.autoPill}`} title="Dime Autopilot is running this team: every automation is at AI">
        <span className={dk.spectrumText}>Autopilot</span>
      </span>
    );
  }
  const why = !pilot.on ? (pilot.paused_by === "system" ? "Dime paused itself" : "check-ins off") : "off on the server";
  return (
    <span className={`${dk.chip} ${pilot.paused_by === "system" ? dk.warnChip : dk.flat}`} title={`Autopilot is switched on, but nothing runs: ${why}`}>
      Autopilot · {why}
    </span>
  );
}

function TeamAutomation({
  model,
  team,
  prefs,
  accountEmail,
  pilot,
  acting,
  open,
  onToggle,
}: {
  model: AccountModel;
  team: TeamResponseData;
  /** The preferences in force on the team: its own over the account's. */
  prefs: NotificationPreference;
  accountEmail: boolean;
  /** The team as Dime reads it, on an account with CV AI; null without. */
  pilot: AiAutopilotTeam | null;
  acting: AiActing | null;
  open: boolean;
  onToggle: () => void;
}) {
  const name = teamName(team);
  const [pending, setPending] = useState(false);
  // Autopilot running the team wears the spectrum; the moment it comes on (here, or from anywhere else) the card
  // plays its sweep once. A card that opens already live starts in its steady state.
  const live = autopilotLive(pilot, acting);
  const [wasLive, setWasLive] = useState(live);
  const [engage, setEngage] = useState(false);
  if (wasLive !== live) {
    setWasLive(live);
    setEngage(live);
  }
  useEffect(() => {
    if (!engage) return;
    const done = window.setTimeout(() => setEngage(false), ENGAGE_MS);
    return () => window.clearTimeout(done);
  }, [engage]);

  const rows: AiAutomationRow[] = pilot ? pilot.rows : prefsTable(prefs, accountEmail);

  const run = (write: Promise<unknown>, done?: string) => {
    setPending(true);
    write
      .then(() => (done ? toast.success(model.demo ? `${done} (demo)` : done) : undefined))
      .catch((err: unknown) => toast.error(aiMessage(err, "Couldn't change that")))
      .finally(() => setPending(false));
  };
  const change = (c: AiAutopilotChange, done?: string) => {
    if (pilot) run(model.setDime(team.team_id, c), done);
  };
  const pick = (r: AiAutomationRow, level: AiLevel) => {
    if (!pilot) {
      // Without CV AI a level is the team's own preference: lineup's email and fill, late scratches' and daily actions' levels
      if (r.row === "lineup") run(model.saveTeamPrefs(team.team_id, lineupPrefs(level)));
      else if (r.row === "late_scratch") run(model.saveTeamPrefs(team.team_id, { late_scratch_level: level as LateScratchLevel }));
      else if (r.row === "daily_actions") run(model.saveTeamPrefs(team.team_id, { daily_actions_level: level as DailyActionsLevel }));
      return;
    }
    // Pausing check-ins leaves the switch on; any other row changed under it turns it off, the rest staying at AI
    if (r.row === "checkins") {
      const on = level === "ai";
      change({ checkins: on }, on ? `Check-ins on for ${name}` : `Check-ins off on ${name}`);
    } else change({ levels: { [r.row]: level } }, pilot.autopilot ? `Autopilot is off on ${name}; the other automations stay at AI` : undefined);
  };
  const labels = pilot ? checkinsLabels(pilot) : undefined;

  return (
    <div
      className={live ? `${s.pilot} ${dk.spectrumEdge}` : s.pilot}
      data-paused-by={pilot?.paused_by ?? undefined}
      data-engage={engage ? "" : undefined}
    >
      {engage ? <span className={dk.spectrumSweep} aria-hidden /> : null}
      <button type="button" className={s.autoHead} aria-expanded={open} onClick={onToggle}>
        <ChevronRight size={14} className={s.autoChevron} aria-hidden />
        <span className={s.itemBody}>
          <span className={s.itemName}>
            <span>{name}</span>
            {pilot?.autopilot ? <AutopilotPill pilot={pilot} acting={acting} /> : null}
          </span>
          <span className={s.itemSub}>{tableLine(rows, pilot?.autopilot)}</span>
        </span>
        <span className={s.autoLeague}>{teamLine(team)}</span>
      </button>
      {open && pilot ? (
        <Toggle
          label={`Autopilot on ${name}`}
          shown={live ? <span className={dk.spectrumText}>Autopilot</span> : "Autopilot"}
          switchClass={live ? dk.spectrumTrack : undefined}
          help={
            <>
              {pilot.autopilot
                ? "Every automation is at AI, check-ins are on and so are Dime's memory and draft rooms. Changing a row turns autopilot off."
                : "Puts every automation at AI, turns check-ins on and turns on Dime's memory and draft rooms. Turning it off puts the automations back."}{" "}
              {statusLine(pilot)}
            </>
          }
          checked={pilot.autopilot}
          disabled={pending}
          onChange={(on) =>
            change({ autopilot: on }, on ? `Autopilot on for ${name}: every automation at AI` : `Autopilot off on ${name}: the automations are back where they were`)
          }
        />
      ) : null}
      {open ? (
        <div className={s.pilotGrid} role="group" aria-label={`Automations on ${name}`}>
          {rows.map((r) => (
            <div key={r.row} className={s.pilotRow}>
              <div className={s.pilotLabel}>
                <span className={s.pilotName}>{r.label}</span>
                <span className={s.fieldHint}>
                  {ROW_HELP[r.row]}
                  {r.note ? <span className={r.note === AUTOPILOT_NOTE ? undefined : s.pilotHeld}> · {r.note}</span> : null}
                </span>
              </div>
              <LevelRail
                label={`${r.label} on ${name}`}
                options={r.options}
                value={r.level}
                labels={r.row === "checkins" ? labels : undefined}
                disabled={pending}
                onPick={(level) => pick(r, level)}
              />
            </div>
          ))}
        </div>
      ) : null}
      {open && pilot ? <div className={s.pilotFoot}>{acting?.available ? policyLine(acting.policy) : ACT_OFF}</div> : null}
    </div>
  );
}

/** Dime's features: the account's, not a team's (its notes span your teams; a draft room comes before one). */
function Features({
  features,
  demo,
  onSet,
}: {
  features: AiFeatures;
  demo: boolean;
  onSet: AccountModel["setFeatures"];
}) {
  const [pending, setPending] = useState(false);
  const change = (c: Partial<AiFeatures>, done: string) => {
    setPending(true);
    onSet(c)
      .then(() => toast.success(demo ? `${done} (demo)` : done))
      .catch((err: unknown) => toast.error(aiMessage(err, "Couldn't change that")))
      .finally(() => setPending(false));
  };
  return (
    <Block
      title="Dime"
      note="for the whole account"
      right={
        <Link href={AI_DESK} className={`${dk.btn} ${dk.btnSmall}`}>
          <MessagesSquare size={12} /> Open the AI desk
        </Link>
      }
    >
      <Toggle
        label="Memory"
        help={
          features.memory ? (
            <>
              Dime keeps notes on your teams, your league and how its moves went, and reads them every turn.{" "}
              <Link href={`${AI_DESK}?v=notebook`}>Read and edit them</Link> in the AI desk&apos;s Notebook.
            </>
          ) : (
            <>
              Dime neither reads nor writes notes. The notes stay, and you can still <Link href={`${AI_DESK}?v=notebook`}>edit them</Link>.
            </>
          )
        }
        checked={features.memory}
        disabled={pending}
        onChange={(memory) => change({ memory }, memory ? "Dime's memory is on" : "Dime's memory is off")}
      />
      <Toggle
        label="Dime in draft rooms"
        help={
          features.draft_rooms ? (
            <>
              A Dime section in every draft room: a plan that sets the room&apos;s punts, a note as each of your picks comes up, your seat in a mock, and a recap. Its notes are on each room&apos;s recap in the{" "}
              <Link href={DRAFT_DESK}>Draft desk</Link>.
            </>
          ) : (
            <>
              Draft rooms show no Dime section, and Dime holding a mock seat hands it back before its next pick. Its notes stay on each room&apos;s recap in the{" "}
              <Link href={DRAFT_DESK}>Draft desk</Link>.
            </>
          )
        }
        checked={features.draft_rooms}
        disabled={pending}
        onChange={(draft_rooms) => change({ draft_rooms }, draft_rooms ? "Dime is back in draft rooms" : "Dime is out of draft rooms")}
      />
    </Block>
  );
}
