"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Download, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { DeskBar, DeskStatus } from "@/components/desk/DeskBar";
import { DeskDialog } from "@/components/desk/DeskDialog";
import { Headshot } from "@/components/desk/Headshot";
import { useDeskTheme } from "@/components/desk/useDeskTheme";
import dk from "@/components/desk/desk.module.css";
import { formatRelativeTime } from "@/lib/relative-time";
import type { DraftSession } from "@/types/draft";
import { CreateRoomDialog, ImportDialog } from "./LobbyDialogs";
import { KIND_LABEL, apiTime } from "./format";
import { roomTitle } from "./RoomView";
import type { LobbyModel } from "./model";
import s from "./draft.module.css";
import { DRAFT_DESK } from "@/components/desk/routes";

type Filter = "active" | "completed" | "all";

export function Lobby({ model }: { model: LobbyModel }) {
  const router = useRouter();
  const toggleTheme = useDeskTheme((st) => st.toggle);
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [renaming, setRenaming] = useState<DraftSession | null>(null);
  const [deleting, setDeleting] = useState<DraftSession | null>(null);

  const rooms = useMemo(() => {
    const sorted = [...model.rooms].sort((a, b) => {
      // Active rooms first, then the most recently touched.
      if (a.status !== b.status) return a.status === "active" ? -1 : b.status === "active" ? 1 : 0;
      return apiTime(b.updated_at ?? b.created_at) - apiTime(a.updated_at ?? a.created_at);
    });
    return filter === "all" ? sorted : sorted.filter((r) => (filter === "active" ? r.status === "active" : r.status !== "active"));
  }, [model.rooms, filter]);

  const { select, selectedId } = model;
  // Something is always selected while there are rooms to show.
  useEffect(() => {
    if (rooms.length && (selectedId == null || !rooms.some((r) => r.id === selectedId))) select(rooms[0].id);
  }, [rooms, selectedId, select]);
  const summary = rooms.find((r) => r.id === selectedId) ?? null;
  const detail = model.selected && model.selected.id === selectedId ? model.selected : summary;

  const dialogOpen = creating || importing || !!renaming || !!deleting;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialogOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest("input, textarea, select, [role='dialog'], [data-radix-popper-content-wrapper]")) return;
      const at = rooms.findIndex((r) => r.id === selectedId);
      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          if (rooms.length) select(rooms[Math.min(rooms.length - 1, at + 1)].id);
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          if (rooms.length) select(rooms[Math.max(0, at - 1)].id);
          break;
        case "Enter":
          if (target?.closest("button, a")) return;
          if (selectedId != null) router.push(model.hrefFor(selectedId, summary?.kind === "import" ? "recap" : "room"));
          break;
        case "n":
          if (model.status === "ready") setCreating(true);
          break;
        case "i":
          if (model.importDraft) setImporting(true);
          break;
        case "t":
          toggleTheme();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen, rooms, selectedId, select, router, model, summary, toggleTheme]);

  const counts = {
    active: model.rooms.filter((r) => r.status === "active").length,
    completed: model.rooms.filter((r) => r.status !== "active").length,
    all: model.rooms.length,
  };

  return (
    <>
      <DeskBar desk="draft" demo={model.demo} onRefresh={model.demo ? undefined : model.refetch}>
        <span style={{ fontWeight: 600 }}>Draft Lab</span>
        <span className={dk.sub}>
          {model.status === "ready" ? `${counts.active} active · ${counts.completed} done` : ""}
        </span>
      </DeskBar>

      {model.status === "signed-out" || model.status === "error" ? (
        <div className={dk.empty}>
          <span className={dk.emptyTitle}>{model.status === "signed-out" ? "Sign in to see your draft rooms" : "Your draft rooms could not be loaded"}</span>
          <span style={{ maxWidth: 440, lineHeight: 1.5 }}>
            {model.status === "signed-out" ? "Rooms belong to your account. The demo runs whole drafts in your browser without one." : model.message}
          </span>
          <span style={{ display: "flex", gap: 10 }}>
            {model.status === "signed-out" ? (
              <Link href={`/sign-in?redirect_url=${DRAFT_DESK}`} className={`${dk.btn} ${dk.btnPrimary}`}>
                Sign in
              </Link>
            ) : (
              <button type="button" className={dk.btn} onClick={model.refetch}>
                Try again
              </button>
            )}
            <Link href={`${DRAFT_DESK}?demo`} className={dk.btn}>
              Open the demo
            </Link>
          </span>
        </div>
      ) : (
        <>
          <div className={s.toolbar}>
            <div className={dk.rail} role="radiogroup" aria-label="Rooms">
              {(["all", "active", "completed"] as const).map((f) => {
                const on = filter === f;
                return (
                  <button key={f} type="button" role="radio" aria-checked={on} className={`${dk.seg} ${on ? dk.segOn : ""}`} onClick={() => setFilter(f)}>
                    {on ? <motion.span layoutId="lobby-pill" className={dk.segPill} transition={{ type: "spring", stiffness: 600, damping: 45 }} /> : null}
                    <span className={dk.segLabel}>
                      {f === "completed" ? "DONE" : f.toUpperCase()} <span className={dk.sub}>{counts[f]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <span className={dk.spacer} />
            {model.reset ? (
              <button type="button" className={dk.btn} onClick={model.reset} title="Put the demo rooms back as they started">
                <RotateCcw size={13} /> Reset demo
              </button>
            ) : null}
            {model.importDraft ? (
              <button type="button" className={dk.btn} onClick={() => setImporting(true)} title="Fold a finished ESPN draft into a room and read its recap">
                <Download size={13} /> Import ESPN draft <span className={dk.kbd}>I</span>
              </button>
            ) : null}
            <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} onClick={() => setCreating(true)} disabled={model.status !== "ready"}>
              <Plus size={13} /> New room <span className={dk.kbd}>N</span>
            </button>
          </div>

          <div className={s.lobby}>
            <div className={s.blotter}>
              <div className={s.blotterHead}>
                <span />
                <span className={dk.label}>Room</span>
                <span className={dk.label}>Kind</span>
                <span className={dk.label}>Format</span>
                <span className={dk.label}>Seat</span>
                <span className={dk.label}>Progress</span>
                <span className={dk.label} style={{ textAlign: "right" }}>
                  Updated
                </span>
              </div>
              <div className={s.blotterBody} role="listbox" aria-label="Draft rooms">
                {model.status === "loading" ? (
                  Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className={s.blotterRow} style={{ opacity: 1 - i * 0.15, cursor: "default" }}>
                      <span />
                      <span className={dk.skel} />
                      <span className={dk.skel} />
                      <span className={dk.skel} />
                      <span className={dk.skel} />
                      <span className={dk.skel} />
                      <span className={dk.skel} />
                    </div>
                  ))
                ) : rooms.length === 0 ? (
                  <div className={dk.empty} style={{ paddingTop: 64 }}>
                    <span className={dk.emptyTitle}>{model.rooms.length ? "Nothing here" : "No draft rooms yet"}</span>
                    <span style={{ maxWidth: 380, lineHeight: 1.5 }}>
                      A room follows your league&apos;s ESPN draft, a mock lobby, or a draft you enter by hand — with the board, the calls and your roster beside every pick.
                    </span>
                    <span style={{ display: "flex", gap: 10 }}>
                      <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} onClick={() => setCreating(true)}>
                        New room
                      </button>
                      {!model.demo ? (
                        <Link href={`${DRAFT_DESK}?demo`} className={dk.btn}>
                          Open the demo
                        </Link>
                      ) : null}
                    </span>
                  </div>
                ) : (
                  rooms.map((r) => <BlotterRow key={r.id} room={r} selected={r.id === selectedId} onSelect={() => select(r.id)} onOpen={() => router.push(model.hrefFor(r.id, r.kind === "import" ? "recap" : "room"))} />)
                )}
              </div>
            </div>
            <aside className={s.detail}>
              {detail ? (
                <RoomDetail
                  room={detail}
                  hrefFor={model.hrefFor}
                  onRename={() => setRenaming(detail)}
                  onFinish={() => void model.finish(detail.id).catch(() => undefined)}
                  onDelete={() => setDeleting(detail)}
                />
              ) : model.status === "ready" && rooms.length ? null : (
                <div className={dk.empty} style={{ color: "var(--text-3)" }}>
                  {model.status === "loading" ? "" : "Pick a room to see it here."}
                </div>
              )}
            </aside>
          </div>
        </>
      )}

      <DeskStatus
        keys={[
          ["j k", "select"],
          ["⏎", "open"],
          ["N", "new room"],
          ...(model.importDraft ? ([["I", "import"]] as Array<[string, string]>) : []),
          ["T", "theme"],
        ]}
      >
        {model.demo ? <span>Demo · rooms live in this browser tab · nothing is sent anywhere</span> : null}
      </DeskStatus>

      <CreateRoomDialog
        open={creating}
        onOpenChange={setCreating}
        model={model}
        onCreated={(session) => {
          setCreating(false);
          router.push(model.hrefFor(session.id));
        }}
      />
      {model.importDraft ? (
        <ImportDialog
          open={importing}
          onOpenChange={setImporting}
          teams={model.teams.filter((t) => t.espn)}
          otherTeams={model.teams.filter((t) => !t.espn).length}
          selectedTeamId={model.selectedTeamId}
          onImport={model.importDraft}
          onDone={(session) => {
            setImporting(false);
            router.push(model.hrefFor(session.id, "recap"));
          }}
          openRoom={(id) => router.push(model.hrefFor(id, "recap"))}
        />
      ) : null}
      {renaming ? <RenameDialog room={renaming} onClose={() => setRenaming(null)} onSave={(name) => model.rename(renaming.id, name)} /> : null}
      <DeskDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete “${roomTitle(deleting)}”?` : ""}
        description={deleting ? `The room and its ${deleting.pick_count} recorded pick${deleting.pick_count === 1 ? "" : "s"} are removed. There is no undo.` : ""}
        cancelLabel="Keep it"
        footer={
          <button
            type="button"
            className={`${dk.btn} ${dk.btnDanger}`}
            onClick={() => {
              const target = deleting;
              setDeleting(null);
              if (target) void model.remove(target.id).catch(() => undefined);
            }}
          >
            Delete
          </button>
        }
      />
    </>
  );
}

function BlotterRow({ room, selected, onSelect, onOpen }: { room: DraftSession; selected: boolean; onSelect: () => void; onOpen: () => void }) {
  const progress = room.total_picks ? Math.min(1, room.pick_count / room.total_picks) : null;
  const when = apiTime(room.updated_at ?? room.created_at);
  return (
    <button type="button" role="option" aria-selected={selected} className={s.blotterRow} onClick={onSelect} onDoubleClick={onOpen}>
      <span className={s.statusDot} data-status={room.status} title={room.status} />
      <span style={{ minWidth: 0 }}>
        <div className={s.roomName}>{roomTitle(room)}</div>
        <div className={dk.sub}>{room.espn_league_id != null ? `ESPN ${room.espn_league_id}` : room.id > 0 ? `#${room.id}` : "demo"}</div>
      </span>
      <span className={s.cellText}>{KIND_LABEL[room.kind]}</span>
      <span className={s.cellText}>
        {[room.league_size ? `${room.league_size} teams` : "no order", room.scoring_format === "categories" ? "9-cat" : room.scoring_format ?? "league", room.draft_type].join(" · ")}
      </span>
      <span className={s.cellText} style={room.my_slot == null ? { color: "var(--warn)" } : undefined}>
        {room.my_slot ?? "unset"}
      </span>
      <span className={s.progress}>
        <span className={s.cellText}>
          {room.status === "active" && room.picks_until_my_turn === 0 ? (
            <span style={{ color: "var(--accent)" }}>on the clock · </span>
          ) : null}
          {room.pick_count}
          {room.total_picks ? ` / ${room.total_picks}` : " picks"}
        </span>
        {progress != null ? (
          <span className={s.progressTrack}>
            <span className={s.progressFill} style={{ width: `${progress * 100}%`, opacity: room.status === "active" ? 1 : 0.35 }} />
          </span>
        ) : null}
      </span>
      <span className={s.cellText} style={{ textAlign: "right", color: "var(--text-3)" }}>
        {when ? formatRelativeTime(when) : "—"}
      </span>
    </button>
  );
}

function RoomDetail({
  room,
  hrefFor,
  onRename,
  onFinish,
  onDelete,
}: {
  room: DraftSession;
  hrefFor: LobbyModel["hrefFor"];
  onRename: () => void;
  onFinish: () => void;
  onDelete: () => void;
}) {
  const mine = room.picks.filter((p) => p.by_me).sort((a, b) => a.overall_pick - b.overall_pick);
  const loadingPicks = room.pick_count > 0 && room.picks.length === 0;
  return (
    <>
      <div className={s.detailHead}>
        <span className={dk.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={s.statusDot} data-status={room.status} />
          {room.status === "active" ? "In progress" : room.status === "completed" ? "Complete" : "Abandoned"}
        </span>
        <h2 className={s.detailTitle}>{roomTitle(room)}</h2>
        <dl className={s.kv} style={{ padding: 0 }}>
          <dt>Picks from</dt>
          <dd>{KIND_LABEL[room.kind]}</dd>
          <dt>Teams</dt>
          <dd>{room.league_size ?? "—"}</dd>
          <dt>Your seat</dt>
          <dd>{room.my_slot ?? "not set"}</dd>
          <dt>Rounds</dt>
          <dd>{room.rounds ?? "—"}</dd>
          <dt>Picks made</dt>
          <dd>
            {room.pick_count}
            {room.total_picks ? ` of ${room.total_picks}` : ""}
          </dd>
          {room.status === "active" && room.my_next_pick != null ? (
            <>
              <dt>Your next pick</dt>
              <dd style={room.picks_until_my_turn === 0 ? { color: "var(--accent)" } : undefined}>
                #{room.my_next_pick}
                {room.picks_until_my_turn === 0 ? " · now" : ` · in ${room.picks_until_my_turn}`}
              </dd>
            </>
          ) : null}
          {room.punts.length ? (
            <>
              <dt>Punting</dt>
              <dd>{room.punts.join(", ")}</dd>
            </>
          ) : null}
        </dl>
        <div className={s.detailActs}>
          {room.kind !== "import" ? (
            <Link href={hrefFor(room.id)} className={`${dk.btn} ${dk.btnPrimary}`}>
              Open room <span className={dk.kbd}>⏎</span>
            </Link>
          ) : null}
          <Link href={hrefFor(room.id, "recap")} className={dk.btn}>
            Recap
          </Link>
          <button type="button" className={dk.btn} onClick={onRename}>
            Rename
          </button>
          {room.status === "active" ? (
            <button type="button" className={dk.btn} onClick={onFinish}>
              Finish
            </button>
          ) : null}
          <button type="button" className={`${dk.btn} ${dk.btnDanger}`} onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
      <div className={s.sectionHead}>
        <span className={dk.label}>Your picks</span>
        <span className={dk.sub}>{mine.length}</span>
      </div>
      <div className={s.sectionBody}>
        {loadingPicks ? (
          Array.from({ length: 4 }, (_, i) => <span key={i} className={dk.skel} style={{ display: "block", margin: "14px 0" }} />)
        ) : mine.length === 0 ? (
          <span className={dk.sub}>{room.my_slot == null ? "No seat set, so no picks are yours yet." : "None yet."}</span>
        ) : (
          <div className={s.pickList}>
            {mine.map((p) => (
              <div key={p.overall_pick} className={s.pickLine}>
                <span className={dk.sub}>#{p.overall_pick}</span>
                <Headshot nbaId={p.player_id} name={p.player_name ?? "?"} size={24} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.player_name ?? "—"}</span>
                <span className={dk.sub}>
                  {p.source === "keeper" ? "keeper · " : ""}
                  {p.round != null ? `R${p.round}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function RenameDialog({ room, onClose, onSave }: { room: DraftSession; onClose: () => void; onSave: (name: string | null) => Promise<void> }) {
  const [name, setName] = useState(room.name ?? "");
  const [saving, setSaving] = useState(false);
  const save = () => {
    setSaving(true);
    onSave(name.trim() || null)
      .then(() => {
        onClose();
        toast.success("Renamed");
      })
      .catch(() => setSaving(false));
  };
  return (
    <DeskDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Rename room"
      description="An empty name goes back to the default."
      footer={
        <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </button>
      }
    >
      <input
        className={dk.input}
        autoFocus
        value={name}
        maxLength={80}
        placeholder={roomTitle({ ...room, name: null })}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
      />
    </DeskDialog>
  );
}
