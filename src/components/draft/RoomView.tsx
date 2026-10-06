"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FastForward, RotateCcw, SkipForward } from "lucide-react";
import { DeskBar, DeskStatus } from "@/components/desk/DeskBar";
import { DeskDialog } from "@/components/desk/DeskDialog";
import { useDeskTheme } from "@/components/desk/useDeskTheme";
import dk from "@/components/desk/desk.module.css";
import { toApiError, userMessage } from "@/lib/api-error";
import { countAtRisk, stepHighlight, targetRow } from "@/lib/draft-board";
import { mockAdvanceToast, mockBlocker, mockMyTurnBlocker, needsSeatConfirm } from "@/lib/draft-mock";
import { fillLineup, keeperStatuses, lastPick, myRoster, openStartingSlots, samePlayer } from "@/lib/draft-roster";
import { buildTape, myUpcoming } from "@/lib/draft-tape";
import { pickIsUndoable, undoBlocker } from "@/lib/draft-undo";
import { canDraftLabel, sendFailureMessage } from "@/lib/espn-draft/sync-state";
import { sendToastId } from "@/hooks/useEspnDraftSync";
import { useVisibleRows } from "@/hooks/useBoardView";
import { useDraftRoomStore } from "@/stores/useDraftRoomStore";
import type { BoardSource, DraftBoardRow, DraftKeeper, DraftRecommendation, DraftSession } from "@/types/draft";
import { BoardTable, BoardToolbar } from "./Board";
import { Calls, Needs, Roster } from "./Rail";
import { KeepersDialog, SeatDialog } from "./RoomDialogs";
import { PickTape } from "./Tape";
import { SyncPill } from "./SyncPill";
import { KIND_LABEL } from "./format";
import type { RoomModel } from "./model";
import s from "./draft.module.css";

const SOURCES: BoardSource[] = ["espn", "cv", "my_team"];

export function roomTitle(session: Pick<DraftSession, "id" | "name" | "kind">): string {
  if (session.name) return session.name;
  if (session.kind === "mock") return "Mock draft";
  if (session.kind === "live") return "Live draft";
  if (session.kind === "import") return "Imported draft";
  return `Draft #${session.id}`;
}

export function roomFacts(session: DraftSession): string {
  const parts = [
    KIND_LABEL[session.kind],
    session.league_size ? `${session.league_size} teams` : null,
    session.scoring_format === "categories" ? "9-cat" : session.scoring_format === "points" ? "points" : null,
    session.draft_type,
  ];
  return parts.filter(Boolean).join(" · ");
}

export function RoomView({ model }: { model: RoomModel }) {
  const { session, board } = model;
  if (model.status !== "ready" || !session) {
    return (
      <>
        <DeskBar desk="draft" demo={model.demo} />
        <RoomState model={model} />
      </>
    );
  }
  return <Room model={model} session={session} board={board} />;
}

function RoomState({ model }: { model: RoomModel }) {
  if (model.status === "loading") {
    return (
      <div className={dk.desk} aria-busy>
        <div className={s.ticker} />
        <div className={s.tape} />
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 18 }}>
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className={dk.skel} style={{ opacity: 1 - i * 0.07 }} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={dk.empty}>
      <span className={dk.emptyTitle}>{model.status === "signed-out" ? "Sign in to open this draft room" : "This room could not be opened"}</span>
      <span style={{ maxWidth: 440, lineHeight: 1.5 }}>
        {model.status === "signed-out" ? "Draft rooms belong to your account. The demo runs a whole draft in your browser without one." : model.message}
      </span>
      <span style={{ display: "flex", gap: 10 }}>
        {model.status === "signed-out" ? (
          <Link href="/sign-in?redirect_url=/draft" className={`${dk.btn} ${dk.btnPrimary}`}>
            Sign in
          </Link>
        ) : (
          <Link href={model.hrefs.lobby} className={dk.btn}>
            All rooms
          </Link>
        )}
        <Link href="/draft?demo" className={dk.btn}>
          Open the demo
        </Link>
      </span>
    </div>
  );
}

function Room({ model, session, board }: { model: RoomModel; session: DraftSession; board: RoomModel["board"] }) {
  const router = useRouter();
  const toggleTheme = useDeskTheme((st) => st.toggle);
  const { highlightId, setHighlight, search, setSearch, boardSource, setBoardSource, toggleSort, setPositionFilter, onlyLikelyGone, setOnlyLikelyGone } =
    useDraftRoomStore();
  const searchRef = useRef<HTMLInputElement>(null);
  const [seatOpen, setSeatOpen] = useState(false);
  const [keepersOpen, setKeepersOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [recordingKeepers, setRecordingKeepers] = useState(false);
  const inflight = useRef(false);

  const rows = useMemo(() => board?.rows ?? [], [board]);
  const meta = board?.meta ?? null;
  const visible = useVisibleRows(rows, meta);
  const active = targetRow(visible, highlightId);
  const activeId = active?.player_id ?? null;
  const sync = model.sync;
  const cats = meta?.value_kind === "cat_value";
  const mock = session.kind === "mock";
  const simBlocker = mockBlocker(session);
  const myTurnBlocker = mockMyTurnBlocker(session);
  const completed = session.status === "completed";

  // A highlight from another room must never aim a keystroke here.
  useEffect(() => {
    setHighlight(null);
    setSearch("");
  }, [session.id, setHighlight, setSearch]);

  // ---- where the draft stands ----
  const tape = useMemo(() => buildTape(session), [session]);
  const upcoming = myUpcoming(tape, 2);
  const espnOnClock = sync?.state.onClock != null && sync.state.myTeamId != null && sync.state.onClock.teamId === sync.state.myTeamId;
  const onTheClock = sync?.state.onClock ? espnOnClock : session.picks_until_my_turn === 0 && session.status === "active";
  const keepers = useMemo(() => keeperStatuses(session.keepers, session.picks), [session]);
  const pendingKeepers = useMemo(() => keepers.filter((k) => !k.recorded && k.blocker === null), [keepers]);
  const keeperIds = useMemo(
    () => new Set(keepers.filter((k) => !k.recorded && k.keeper.player_id != null).map((k) => k.keeper.player_id as number)),
    [keepers]
  );
  const players = useMemo(() => myRoster(board?.roster ?? [], session.picks), [board, session.picks]);
  const openSlots = openStartingSlots(fillLineup(meta?.roster_slots ?? {}, players)).reduce((a, o) => a + o.open, 0);
  const atRisk = useMemo(() => countAtRisk(rows), [rows]);

  // ---- the Draft Tap's write path ----
  const writeUi = !!sync && sync.configured && sync.state.connection !== "unconfigured" && sync.state.connection !== "unsupported";
  const espnDisabled = sync && !sync.canDraft.ok ? canDraftLabel(sync.canDraft.reason) : null;

  const isPendingKeeper = useCallback(
    (row: DraftBoardRow) => pendingKeepers.some((k) => samePlayer(k.keeper, { player_id: row.player_id, espn_player_id: row.espn_id, player_name: row.name })),
    [pendingKeepers]
  );

  // ---- writes ----
  const mark = useCallback(
    (row: DraftBoardRow, byMe: boolean) => {
      // Two quick keystrokes must not race two posts for "the lowest unused pick".
      if (inflight.current || model.picking) return;
      if (completed) {
        toast.message("This draft is complete");
        return;
      }
      if (isPendingKeeper(row)) {
        toast.error(`${row.name} is one of your keepers — record him from the roster`);
        return;
      }
      if (byMe && row.cap_blocked) {
        toast.error(`${row.name} would break your ${row.primary_position ?? "position"} cap`);
        return;
      }
      inflight.current = true;
      model
        .pick({ player_id: row.player_id, espn_player_id: row.espn_id, player_name: row.name, by_me: byMe, source: "manual", overall_pick: null, bid: null })
        .then((pick) => toast.success(byMe ? `You drafted ${row.name} at ${pick.overall_pick}` : `${row.name} off the board at ${pick.overall_pick}`))
        .catch(() => undefined)
        .finally(() => {
          inflight.current = false;
        });
    },
    [model, completed, isPendingKeeper]
  );

  const draftOnEspn = useCallback(
    async (row: DraftBoardRow) => {
      if (!sync) return;
      if (!sync.canDraft.ok) {
        toast.error(canDraftLabel(sync.canDraft.reason));
        return;
      }
      if (row.espn_id == null) {
        toast.error(`${row.name} has no ESPN id here — draft him in the ESPN tab`);
        return;
      }
      if (isPendingKeeper(row)) {
        toast.error(`${row.name} is one of your keepers — record him from the roster`);
        return;
      }
      if (row.cap_blocked) {
        toast.error(`${row.name} would break your ${row.primary_position ?? "position"} cap`);
        return;
      }
      const id = sendToastId(row.espn_id);
      toast.loading(`Sending ${row.name} to ESPN…`, { id });
      const result = await sync.draftPlayer(row);
      if (result.outcome === "echoed") toast.success(`ESPN has ${row.name}`, { id });
      else if (result.outcome === "refused") toast.error(canDraftLabel(result.reason), { id });
      else if (result.outcome === "timeout") toast.error(`No answer from ESPN for ${row.name} — check the ESPN tab`, { id });
      else toast.error(sendFailureMessage(result.reason, result.detail), { id });
    },
    [sync, isPendingKeeper]
  );

  const rowFor = useCallback(
    (rec: DraftRecommendation) => {
      const row = rows.find((r) => r.player_id === rec.player_id);
      if (!row) toast.error(`${rec.name} is no longer on the board`);
      return row ?? null;
    },
    [rows]
  );

  const undoLast = useCallback(() => {
    const last = lastPick(session.picks);
    if (!last) {
      toast.message("Nothing to undo");
      return;
    }
    // ⌘Z means "take back what just happened"; it never reaches for an earlier pick instead.
    const blocked = undoBlocker(session, last);
    if (blocked) {
      toast.message(blocked);
      return;
    }
    model
      .undo(last.overall_pick)
      .then(() => model.demo && toast.success(`Pick ${last.overall_pick} undone`))
      .catch(() => undefined);
  }, [session, model]);

  const undoPick = useCallback(
    (overall: number) => {
      model
        .undo(overall)
        .then(() => model.demo && toast.success(`Pick ${overall} undone`))
        .catch(() => undefined);
    },
    [model]
  );
  const canUndo = useCallback(
    (overall: number) => {
      const pick = session.picks.find((p) => p.overall_pick === overall);
      return !!pick && pickIsUndoable(session, pick);
    },
    [session]
  );

  const runAdvance = useCallback(
    (until: "my_turn" | "end") => {
      if (model.advancing) return;
      model
        .advance(until)
        .then((result) => {
          const { title, description } = mockAdvanceToast(result);
          const notify = result.stopped_reason === "cap_blocked" || result.stopped_reason === "pool_exhausted" ? toast.message : toast.success;
          notify(title, { description });
        })
        .catch(() => undefined);
    },
    [model]
  );
  const simToMe = useCallback(() => {
    if (myTurnBlocker) {
      toast.message(myTurnBlocker);
      return;
    }
    runAdvance("my_turn");
  }, [myTurnBlocker, runAdvance]);
  const simToEnd = useCallback(() => {
    if (needsSeatConfirm(session)) setConfirmEnd(true);
    else runAdvance("end");
  }, [session, runAdvance]);

  const togglePunt = useCallback(
    (key: string) => {
      const next = session.punts.includes(key) ? session.punts.filter((k) => k !== key) : [...session.punts, key];
      model.update({ punts: next }).catch(() => undefined);
    },
    [session.punts, model]
  );

  const saveSeat = useCallback(
    (slot: number | null) => {
      model
        .update({ my_slot: slot })
        .then(() => {
          setSeatOpen(false);
          toast.success(slot == null ? "Seat cleared" : `You are drafting from seat ${slot}`);
        })
        .catch(() => undefined);
    },
    [model]
  );

  const saveKeepers = useCallback(
    (list: DraftKeeper[]) => {
      model
        .update({ keepers: list })
        .then(() => {
          setKeepersOpen(false);
          toast.success(`${list.length} keeper${list.length === 1 ? "" : "s"} saved`);
        })
        .catch(() => undefined);
    },
    [model]
  );

  const recordKeepers = useCallback(async () => {
    setRecordingKeepers(true);
    let recorded = 0;
    try {
      for (const { keeper } of pendingKeepers) {
        if (keeper.overall_pick == null) continue;
        await model.pick({
          player_id: keeper.player_id ?? null,
          espn_player_id: keeper.espn_player_id ?? null,
          player_name: keeper.name ?? null,
          by_me: true,
          source: "keeper",
          overall_pick: keeper.overall_pick,
          bid: null,
        });
        recorded += 1;
      }
      toast.success(`${recorded} keeper${recorded === 1 ? "" : "s"} recorded`);
    } catch {
      // The model said why.
    } finally {
      setRecordingKeepers(false);
    }
  }, [pendingKeepers, model]);

  const linkRoom = useCallback(async () => {
    if (!sync?.unbound) return;
    const espnLeagueId = sync.unbound.espnLeagueId;
    try {
      await sync.linkRoom();
      toast.success(`Linked to ESPN room ${espnLeagueId}`);
    } catch (error) {
      const api = toApiError(error);
      const existing = (api.data as { existing_session_id?: number } | null)?.existing_session_id;
      if (api.code === "DRAFT_ROOM_ALREADY_LINKED" && existing) {
        toast.error(`ESPN room ${espnLeagueId} is already linked to Draft #${existing}`, {
          action: { label: "Open it", onClick: () => router.push(`/draft/${existing}`) },
        });
      } else {
        toast.error(userMessage(error));
      }
    }
  }, [sync, router]);

  // ---- keyboard ----
  const move = useCallback(
    (delta: 1 | -1) => setHighlight(stepHighlight(visible.map((r) => r.player_id), activeId, delta)),
    [visible, activeId, setHighlight]
  );
  const markActive = useCallback(
    (byMe: boolean) => {
      if (!active) return;
      mark(active, byMe);
      setSearch("");
      setHighlight(null);
    },
    [active, mark, setSearch, setHighlight]
  );
  const focusPlayer = useCallback(
    (playerId: number) => {
      const row = rows.find((r) => r.player_id === playerId);
      if (!row) return;
      if (!visible.some((r) => r.player_id === playerId)) {
        setSearch("");
        setPositionFilter("all");
        if (onlyLikelyGone && row.availability !== "gone") setOnlyLikelyGone(false);
      }
      setHighlight(playerId);
    },
    [rows, visible, setSearch, setPositionFilter, onlyLikelyGone, setOnlyLikelyGone, setHighlight]
  );

  const dialogOpen = seatOpen || keepersOpen || confirmEnd;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialogOpen || e.defaultPrevented) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target === searchRef.current) return; // the search box has its own keys
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], [data-radix-popper-content-wrapper]")) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undoLast();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const onButton = target?.closest("button, a") != null;
      switch (e.key) {
        case "/":
          e.preventDefault();
          searchRef.current?.focus();
          break;
        case "j":
        case "ArrowDown":
          e.preventDefault();
          move(1);
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          move(-1);
          break;
        case "Enter":
          if (onButton) return;
          e.preventDefault();
          markActive(e.shiftKey);
          break;
        case "o":
          markActive(false);
          break;
        case "m":
          markActive(true);
          break;
        case "d":
          if (writeUi && active) void draftOnEspn(active);
          break;
        case "s":
          if (mock && !simBlocker) simToMe();
          break;
        case "f":
          if (cats) toggleSort("fit_rank");
          break;
        case "b":
          setBoardSource(SOURCES[(SOURCES.indexOf(boardSource) + 1) % SOURCES.length]);
          break;
        case "t":
          toggleTheme();
          break;
        case "r":
          if (completed) router.push(model.hrefs.recap);
          break;
        case "Escape":
          setHighlight(null);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen, undoLast, move, markActive, writeUi, active, draftOnEspn, mock, simBlocker, simToMe, cats, toggleSort, setBoardSource, boardSource, toggleTheme, completed, router, model.hrefs.recap, setHighlight]);

  const onSearchKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.altKey) {
          if (writeUi && active) void draftOnEspn(active);
          return;
        }
        markActive(e.shiftKey);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (search) setSearch("");
        else searchRef.current?.blur();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !search) {
        e.preventDefault();
        undoLast();
      }
    },
    [writeUi, active, draftOnEspn, markActive, move, search, setSearch, undoLast]
  );

  // ---- ESPN's clock, when the tap reports one ----
  const [now, setNow] = useState(() => Date.now());
  const clock = sync?.state.onClock ?? null;
  useEffect(() => {
    if (!clock) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [clock]);
  const secondsLeft = clock ? Math.max(0, Math.round((clock.at + clock.msRemaining - now) / 1000)) : null;

  const nextRound = tape.find((c) => c.state === "now")?.round ?? null;
  const total = session.total_picks;
  const statusKeys: Array<[string, string]> = [
    ["/", "find"],
    ["j k", "move"],
    ["⏎", "taken"],
    ["⇧⏎", "mine"],
    ...(writeUi ? ([["D", "ESPN"]] as Array<[string, string]>) : []),
    ["⌘Z", "undo"],
    ...(mock && !simBlocker ? ([["S", "sim to me"]] as Array<[string, string]>) : []),
    ["B", "board"],
    ...(cats ? ([["F", "fit"]] as Array<[string, string]>) : []),
    ["T", "theme"],
  ];

  return (
    <>
      <DeskBar
        desk="draft"
        demo={model.demo}
        onRefresh={model.demo ? undefined : model.refetch}
        right={sync && sync.configured && sync.state.connection !== "unconfigured" ? <SyncPill sync={sync} onLink={() => void linkRoom()} /> : null}
      >
        <span style={{ fontWeight: 600 }}>{roomTitle(session)}</span>
        <span className={dk.sub}>{roomFacts(session)}</span>
      </DeskBar>

      <div className={s.ticker}>
        <div className={s.tick}>
          <span className={dk.label}>Pick</span>
          <span className={s.tickValue}>
            {completed ? session.pick_count : Math.min(session.next_overall_pick, total ?? Infinity)}
            <span className={s.tickSub}>
              {total ? `of ${total}` : ""}
              {!completed && nextRound ? ` · R${nextRound}` : ""}
            </span>
          </span>
        </div>
        <ClockTick
          session={session}
          onTheClock={onTheClock}
          upcoming={upcoming}
          secondsLeft={secondsLeft}
          recapHref={model.hrefs.recap}
          onSetSeat={() => setSeatOpen(true)}
        />
        <button type="button" className={`${s.tick} ${s.tickBtn}`} onClick={() => setSeatOpen(true)} title="Set or correct which seat is yours">
          <span className={dk.label}>Seat</span>
          <span className={s.tickValue}>
            {session.my_slot ?? "—"}
            <span className={s.tickSub}>{session.league_size ? `of ${session.league_size}` : ""}</span>
          </span>
        </button>
        <div className={s.tick}>
          <span className={dk.label}>Roster</span>
          <span className={s.tickValue}>
            {players.length}
            <span className={s.tickSub}>
              {session.rounds ? `of ${session.rounds}` : ""}
              {meta && players.length ? ` · ${openSlots} starter${openSlots === 1 ? "" : "s"} open` : ""}
            </span>
          </span>
        </div>
        {!completed && atRisk > 0 ? (
          <button type="button" className={`${s.tick} ${s.tickBtn}`} onClick={() => setOnlyLikelyGone(!onlyLikelyGone)} title="Players the market expects to be gone before your next pick — click to show only them">
            <span className={dk.label}>At risk</span>
            <span className={s.tickValue}>
              {atRisk}
              <span className={s.tickSub}>{upcoming[0] != null ? `gone before #${upcoming[0] === session.next_overall_pick ? upcoming[1] ?? upcoming[0] : upcoming[0]}` : "likely gone"}</span>
            </span>
          </button>
        ) : null}
        <div className={s.tickActions}>
          {mock && !simBlocker ? (
            <>
              <button type="button" className={dk.btn} disabled={model.advancing || !!myTurnBlocker} onClick={simToMe} title={myTurnBlocker ?? "Run the other seats up to your next pick"}>
                <FastForward size={13} />
                {model.advancing ? "Simulating…" : "Sim to my pick"}
                <span className={dk.kbd}>S</span>
              </button>
              <button type="button" className={dk.btn} disabled={model.advancing} onClick={simToEnd} title="Run every remaining pick, yours included">
                <SkipForward size={13} />
                Sim to end
              </button>
            </>
          ) : null}
          <button type="button" className={dk.btn} disabled={model.undoing || session.picks.length === 0} onClick={undoLast} title="Undo the last pick (⌘Z)">
            <RotateCcw size={13} />
            Undo
          </button>
          {completed ? (
            <Link href={model.hrefs.recap} className={`${dk.btn} ${dk.btnPrimary}`}>
              Recap <span className={dk.kbd}>R</span>
            </Link>
          ) : null}
        </div>
      </div>

      <PickTape cells={tape} session={session} />

      {sync?.state.reset ? (
        <div className={s.banner}>
          <span className={dk.grow}>
            <strong>ESPN reset this draft.</strong> Sync is paused so nothing is deleted on its own — undo picks by hand or start a new room, then resume.
          </span>
          <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={sync.resume}>
            Resume sync
          </button>
        </div>
      ) : sync?.unbound && !sync.unbound.dismissed ? (
        <div className={`${s.banner} ${s.bannerWarn}`}>
          <span className={dk.grow}>
            An ESPN draft room is open (league {sync.unbound.espnLeagueId}). Link this room to it and its picks arrive here.
          </span>
          <button type="button" className={`${dk.btn} ${dk.btnSmall} ${dk.btnPrimary}`} onClick={() => void linkRoom()}>
            Link
          </button>
          <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={sync.ignoreRoom}>
            Ignore
          </button>
        </div>
      ) : null}

      <div className={s.room}>
        <div className={s.main}>
          <BoardToolbar
            ref={searchRef}
            meta={meta}
            rows={rows}
            visibleCount={visible.length}
            search={search}
            onSearch={(v) => {
              setSearch(v);
              setHighlight(null);
            }}
            onSearchKey={onSearchKey}
            atRisk={atRisk}
          />
          {model.boardError ? (
            <div className={dk.empty}>
              <span className={dk.emptyTitle}>The board could not be loaded</span>
              <span>{model.boardError}</span>
            </div>
          ) : (
            <BoardTable
              meta={meta}
              rows={rows}
              visible={visible}
              activeId={activeId}
              onActivate={setHighlight}
              keeperIds={keeperIds}
              loading={model.boardLoading}
              message={board?.message ?? ""}
              onMark={mark}
              onEspn={writeUi ? (row) => void draftOnEspn(row) : undefined}
              espnDisabled={espnDisabled}
              marking={model.picking || completed}
              pendingEspnId={sync?.state.pending?.playerId ?? null}
            />
          )}
        </div>
        <aside className={s.rail}>
          <Calls
            recommendations={board?.recommendations ?? []}
            onTheClock={onTheClock}
            nextPick={upcoming[0] ?? null}
            activeId={activeId}
            onFocus={focusPlayer}
            onTake={(rec) => {
              const row = rowFor(rec);
              if (row) mark(row, true);
            }}
            onEspn={
              writeUi
                ? (rec) => {
                    const row = rowFor(rec);
                    if (row) void draftOnEspn(row);
                  }
                : undefined
            }
            espnDisabled={espnDisabled}
            marking={model.picking || completed}
            loading={model.boardLoading}
          />
          <Needs board={board} onPunt={completed ? null : togglePunt} saving={model.updating} />
          <Roster
            session={session}
            board={board}
            keepers={keepers}
            onEditKeepers={() => setKeepersOpen(true)}
            onRecordKeepers={() => void recordKeepers()}
            recordingKeepers={recordingKeepers || model.picking}
            onUndo={completed ? null : undoPick}
            canUndo={canUndo}
          />
        </aside>
      </div>

      <DeskStatus keys={statusKeys}>
        {model.demo ? <span>Demo · sample pool from the dev database · nothing leaves your browser</span> : null}
        {!model.demo && meta?.market_as_of ? <span>ESPN market as of {meta.market_as_of}</span> : null}
      </DeskStatus>

      <SeatDialog session={session} open={seatOpen} onOpenChange={setSeatOpen} onSave={saveSeat} saving={model.updating} />
      <KeepersDialog
        session={session}
        rows={rows}
        open={keepersOpen}
        onOpenChange={setKeepersOpen}
        onSave={saveKeepers}
        saving={model.updating}
        onEditSeat={() => {
          setKeepersOpen(false);
          setSeatOpen(true);
        }}
      />
      <DeskDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title="Simulate the rest of the draft?"
        description="Every remaining pick is made, yours included: your seat takes the top call each time. Undo works pick by pick afterwards."
        footer={
          <button
            type="button"
            className={`${dk.btn} ${dk.btnPrimary}`}
            disabled={model.advancing}
            onClick={() => {
              setConfirmEnd(false);
              runAdvance("end");
            }}
          >
            Simulate to the end
          </button>
        }
      />
    </>
  );
}

function ClockTick({
  session,
  onTheClock,
  upcoming,
  secondsLeft,
  recapHref,
  onSetSeat,
}: {
  session: DraftSession;
  onTheClock: boolean;
  upcoming: number[];
  secondsLeft: number | null;
  recapHref: string;
  onSetSeat: () => void;
}) {
  if (session.status === "completed") {
    return (
      <Link href={recapHref} className={`${s.tick} ${s.tickBtn}`} style={{ textDecoration: "none" }}>
        <span className={dk.label}>Draft complete</span>
        <span className={s.tickValue}>
          Read the recap <span className={s.tickSub}>→</span>
        </span>
      </Link>
    );
  }
  if (session.my_slot == null) {
    return (
      <button type="button" className={`${s.tick} ${s.tickBtn}`} onClick={onSetSeat}>
        <span className={dk.label} style={{ color: "var(--warn)" }}>
          Your turn
        </span>
        <span className={s.tickValue}>
          Set your seat <span className={s.tickSub}>to see whose turn it is</span>
        </span>
      </button>
    );
  }
  const clock = secondsLeft != null ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` : null;
  if (onTheClock) {
    return (
      <div className={`${s.tick} ${s.clockOn}`}>
        <span className={dk.label} style={{ color: "var(--accent)" }}>
          On the clock
        </span>
        <span className={s.tickValue}>
          <span className={s.clockDot} />
          You · #{session.next_overall_pick}
          {clock ? (
            <span className={`${s.tickSub} ${s.countdown}`} data-low={secondsLeft! <= 10}>
              {clock}
            </span>
          ) : upcoming[1] ? (
            <span className={s.tickSub}>then #{upcoming[1]}</span>
          ) : null}
        </span>
      </div>
    );
  }
  const until = session.picks_until_my_turn;
  return (
    <div className={s.tick}>
      <span className={dk.label}>Your turn</span>
      <span className={s.tickValue}>
        {until != null ? `in ${until}` : "—"}
        <span className={s.tickSub}>
          {session.my_next_pick != null ? `#${session.my_next_pick}` : "no picks left"}
          {upcoming[1] != null && upcoming[0] === session.my_next_pick ? ` · then #${upcoming[1]}` : ""}
          {clock ? ` · ESPN clock ${clock}` : ""}
        </span>
      </span>
    </div>
  );
}
