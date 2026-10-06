"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeskDialog } from "@/components/desk/DeskDialog";
import dk from "@/components/desk/desk.module.css";
import { toApiError } from "@/lib/api-error";
import { importFailure, type ImportFailure } from "@/lib/draft-import";
import { DEMO_POOL } from "@/lib/draft-demo";
import { useTeamLeagueQuery } from "@/hooks/useTeams";
import type { DraftKind, DraftSession, DraftType, ScoringFormat } from "@/types/draft";
import type { LobbyModel, TeamChoice } from "./model";
import s from "./draft.module.css";

const NO_TEAM = 0;

/** Where the picks come from — the one choice that shapes everything else about a room. */
const SOURCES: Array<{ value: DraftKind; title: string; text: string; espnOnly?: boolean }> = [
  {
    value: "live",
    title: "This league's ESPN draft",
    text: "Picks arrive from your league's ESPN draft room through the Draft Tap. The room is linked to that league from the start.",
    espnOnly: true,
  },
  {
    value: "mock",
    title: "A mock draft",
    text: "Court Vision plays the other seats, or join any ESPN mock lobby with these settings and the room follows it.",
  },
  {
    value: "manual",
    title: "I enter every pick",
    text: "Nothing connects to ESPN; you record picks as they happen.",
  },
];

/**
 * Start a room. Two questions decide its shape: whose settings it uses (a
 * team's league, or none) and where its picks come from. Everything the
 * provider told us is prefilled from the league, so the one thing asked is
 * which seat is yours: the league's pick order holds ESPN team ids that do not
 * map back to ours.
 */
export function CreateRoomDialog({
  open,
  onOpenChange,
  model,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: LobbyModel;
  onCreated: (session: DraftSession) => void;
}) {
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState<number>(NO_TEAM);
  const [kind, setKind] = useState<DraftKind>("mock");
  const [draftType, setDraftType] = useState<DraftType | "">("");
  const [seats, setSeats] = useState("10");
  const [rounds, setRounds] = useState("");
  const [slot, setSlot] = useState<number | null>(null);
  const [format, setFormat] = useState<ScoringFormat>("points");
  const [existing, setExisting] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // Fresh form each time, on the selected team when it is one of yours.
  useEffect(() => {
    if (!open) return;
    const preferred = model.teams.find((t) => t.id === model.selectedTeamId) ?? null;
    setName("");
    setTeamId(preferred?.id ?? NO_TEAM);
    setKind(preferred?.espn ? "live" : "mock");
    setDraftType("");
    setSeats("10");
    setRounds("");
    setSlot(null);
    setFormat("points");
    setExisting(null);
  }, [open, model.teams, model.selectedTeamId]);

  const team: TeamChoice | null = model.teams.find((t) => t.id === teamId) ?? null;
  const sources = SOURCES.filter((src) => !src.espnOnly || team?.espn);
  useEffect(() => {
    if (!sources.some((src) => src.value === kind)) setKind("mock");
  }, [sources, kind]);

  // `draft_settings` lives on the league detail, not the team summary: fetched to size the seat picker.
  const league = useTeamLeagueQuery(team?.id ?? null);
  const leagueSeats = useMemo(() => {
    const order = league.data?.draft_settings?.pick_order;
    return Array.isArray(order) ? order.length : 0;
  }, [league.data]);
  const leagueUnknown = team !== null && league.isPending;
  const ownSeats = useMemo(() => {
    if (team) return null;
    const n = Number(seats);
    return Number.isInteger(n) && n >= 2 && n <= (model.demo ? 16 : 30) ? n : null;
  }, [team, seats, model.demo]);
  const seatCount = leagueSeats > 0 ? leagueSeats : ownSeats ?? 0;
  useEffect(() => {
    setSlot((x) => (x != null && x > seatCount ? null : x));
  }, [seatCount]);
  const roundsValue = rounds === "" ? null : Math.max(1, Math.floor(Number(rounds)));
  const tooBig = model.demo && ownSeats != null && ownSeats * (roundsValue ?? 13) > DEMO_POOL;
  const slotRequired = leagueSeats > 0;
  const blocked = (slotRequired && slot == null) || leagueUnknown || (!team && ownSeats == null) || tooBig;

  const create = async () => {
    setBusy(true);
    setExisting(null);
    try {
      const session = await model.create({
        name: name.trim() || null,
        team_id: team?.id ?? null,
        kind: model.demo ? "mock" : kind,
        draft_type: model.demo ? "snake" : draftType === "" ? null : draftType,
        my_slot: slot,
        rounds: roundsValue,
        // Seats for a team-less room: positional ids, only their count matters.
        pick_order: ownSeats == null ? null : Array.from({ length: ownSeats }, (_, i) => i + 1),
        scoring_format: team ? null : format,
        keepers: [],
      });
      onCreated(session);
    } catch (error) {
      // One live room per league: point at the one that exists.
      const api = toApiError(error);
      const id = (api.data as { existing_session_id?: number } | null)?.existing_session_id;
      if (api.code === "DRAFT_ROOM_ALREADY_LINKED" && id) setExisting(id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DeskDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="New draft room"
      description={model.demo ? "A demo room drafts from a real snapshot of this season's pool, in your browser." : undefined}
      footer={
        <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} disabled={blocked || busy || model.creating} onClick={() => void create()}>
          {busy ? "Opening…" : "Open room"}
        </button>
      }
    >
      <div className={s.field}>
        <span className={s.fieldLabel}>Name</span>
        <input className={dk.input} value={name} maxLength={80} placeholder="Optional — e.g. Home league, mock 3" onChange={(e) => setName(e.target.value)} />
      </div>

      {!model.demo ? (
        <div className={s.field}>
          <span className={s.fieldLabel}>Settings from</span>
          <select className={dk.input} value={teamId} onChange={(e) => setTeamId(Number(e.target.value))}>
            <option value={NO_TEAM}>No league — generic settings</option>
            {model.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.tag}
              </option>
            ))}
          </select>
          <span className={s.fieldHelp}>
            {team ? "Draft type, pick order, rounds and keepers come from this team's league." : "Say how many teams and how the league scores."}
          </span>
        </div>
      ) : null}

      {!team ? (
        <div className={s.row2}>
          <div className={s.field}>
            <span className={s.fieldLabel}>Teams</span>
            <input className={dk.input} type="number" min={2} max={model.demo ? 16 : 30} value={seats} onChange={(e) => setSeats(e.target.value)} />
          </div>
          <div className={s.field}>
            <span className={s.fieldLabel}>Scoring</span>
            <div className={dk.rail} role="radiogroup" aria-label="Scoring">
              {(["points", "categories"] as const).map((f) => (
                <button key={f} type="button" role="radio" aria-checked={format === f} className={`${dk.seg} ${format === f ? dk.segOn : ""}`} onClick={() => setFormat(f)} style={{ flex: 1, justifyContent: "center" }}>
                  {format === f ? <span className={dk.segPill} /> : null}
                  <span className={dk.segLabel}>{f === "points" ? "POINTS" : "9-CAT"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {!model.demo ? (
        <div className={s.field}>
          <span className={s.fieldLabel}>Picks come from</span>
          <div className={s.choices} role="radiogroup">
            {sources.map((src) => (
              <button key={src.value} type="button" role="radio" aria-checked={kind === src.value} className={s.choice} onClick={() => setKind(src.value)}>
                <span className={s.radio} />
                <span>
                  <div className={s.choiceTitle}>{src.title}</div>
                  <div className={s.choiceText}>{src.text}</div>
                </span>
              </button>
            ))}
          </div>
          {existing ? (
            <span className={dk.error}>
              This league&apos;s draft already has a room —{" "}
              <a className={dk.link} href={model.hrefFor(existing)}>
                open #{existing}
              </a>
              .
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={s.field}>
        <span className={s.fieldLabel}>Your seat {slotRequired ? "" : "(optional)"}</span>
        {seatCount > 0 ? (
          <div className={s.seats}>
            {Array.from({ length: seatCount }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={s.seatBtn} aria-pressed={slot === n} onClick={() => setSlot(slot === n ? null : n)}>
                {n}
              </button>
            ))}
          </div>
        ) : (
          <span className={s.fieldHelp}>{leagueUnknown ? "Reading the league's pick order…" : "No pick order yet — set your seat in the room once there is one."}</span>
        )}
      </div>

      <div className={s.row2}>
        {!model.demo ? (
          <div className={s.field}>
            <span className={s.fieldLabel}>Draft type</span>
            <select className={dk.input} value={draftType} onChange={(e) => setDraftType(e.target.value as DraftType | "")}>
              <option value="">{team ? "League default" : "Snake"}</option>
              <option value="snake">Snake</option>
              <option value="auction">Auction</option>
            </select>
          </div>
        ) : null}
        <div className={s.field}>
          <span className={s.fieldLabel}>Rounds</span>
          <input className={dk.input} type="number" min={1} max={40} value={rounds} placeholder={team ? "League's roster size" : "13"} onChange={(e) => setRounds(e.target.value)} />
        </div>
      </div>
      {tooBig ? <span className={dk.error}>The demo pool holds {DEMO_POOL} players: fewer teams or rounds.</span> : null}
    </DeskDialog>
  );
}

/**
 * Import a finished ESPN draft: a room is opened for the team, the completed
 * draft folded in, and the recap opened. ESPN writes picks only when the draft
 * completes, so an unfinished one is refused.
 */
export function ImportDialog({
  open,
  onOpenChange,
  teams,
  otherTeams,
  selectedTeamId,
  onImport,
  onDone,
  openRoom,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamChoice[];
  otherTeams: number;
  selectedTeamId: number | null;
  onImport: (teamId: number, name: string | null) => Promise<DraftSession>;
  onDone: (session: DraftSession) => void;
  openRoom: (id: number) => void;
}) {
  const [teamId, setTeamId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ImportFailure | null>(null);
  useEffect(() => {
    if (!open) return;
    setTeamId((teams.find((t) => t.id === selectedTeamId) ?? teams[0])?.id ?? null);
    setName("");
    setFailure(null);
  }, [open, teams, selectedTeamId]);

  const run = async () => {
    if (teamId == null) return;
    setBusy(true);
    setFailure(null);
    try {
      const session = await onImport(teamId, name.trim() || null);
      toast.success(`Imported ${session.pick_count} pick${session.pick_count === 1 ? "" : "s"} from ESPN`);
      onDone(session);
    } catch (error) {
      const f = importFailure(error);
      const kept = (error as { keptSessionId?: number } | null)?.keptSessionId;
      setFailure(f.outcomeUnknown && kept != null ? { ...f, existingSessionId: kept } : f);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DeskDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Import an ESPN draft"
      description="Drafted without a room? Fold the finished ESPN draft in and read its recap: every pick priced, every seat graded."
      footer={
        <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} disabled={busy || teamId == null} onClick={() => void run()}>
          {busy ? "Importing…" : "Import"}
        </button>
      }
    >
      {teams.length === 0 ? (
        <span className={s.fieldHelp}>Only ESPN drafts can be imported, and none of your teams is in an ESPN league.</span>
      ) : (
        <>
          <div className={s.field}>
            <span className={s.fieldLabel}>Team</span>
            <select className={dk.input} value={teamId ?? ""} onChange={(e) => setTeamId(Number(e.target.value))}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.tag}
                </option>
              ))}
            </select>
            {otherTeams > 0 ? <span className={s.fieldHelp}>Yahoo drafts cannot be imported yet.</span> : null}
          </div>
          <div className={s.field}>
            <span className={s.fieldLabel}>Name</span>
            <input className={dk.input} value={name} maxLength={80} placeholder="Optional" onChange={(e) => setName(e.target.value)} />
          </div>
        </>
      )}
      {failure ? (
        <span className={dk.error}>
          {failure.message}{" "}
          {failure.existingSessionId != null ? (
            <button type="button" className={dk.link} style={{ background: "none", border: 0, padding: 0, font: "inherit", cursor: "pointer" }} onClick={() => openRoom(failure.existingSessionId!)}>
              Open it
            </button>
          ) : null}
        </span>
      ) : null}
    </DeskDialog>
  );
}
