"use client";

import { useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { userMessage } from "@/lib/api-error";
import { importFailure } from "@/lib/draft-import";
import {
  DemoRefusal,
  demoAdvance,
  demoBoard,
  demoPick,
  demoRecap,
  demoSession,
  demoSlug,
  demoUndo,
  type DemoRoom,
} from "@/lib/draft-demo";
import { useEspnDraftSync } from "@/hooks/useEspnDraftSync";
import {
  useCreateDraftSessionMutation,
  useDeleteDraftSessionMutation,
  useDraftBoardQuery,
  useDraftImportMutation,
  useDraftPickMutation,
  useDraftRecapQuery,
  useDraftSessionQuery,
  useDraftSessionsQuery,
  useMockAdvanceMutation,
  useUndoDraftPickMutation,
  useUpdateDraftSessionMutation,
} from "@/hooks/useDrafts";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import { useDraftRoomStore } from "@/stores/useDraftRoomStore";
import { apiClient } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { draftKeys } from "@/hooks/useDrafts";
import type { DraftSession, DraftSessionUpdate } from "@/types/draft";
import { useDemoDrafts, useDemoFixtures, useDemoReady } from "./useDemoDrafts";
import type { LobbyModel, RecapModel, RoomModel, TeamChoice } from "./model";
import { DRAFT_DESK } from "@/components/desk/routes";

const liveHrefs = (id: number) => ({ lobby: DRAFT_DESK, room: `${DRAFT_DESK}/${id}`, recap: `${DRAFT_DESK}/${id}/recap` });
const demoHrefs = (id: number) => ({
  lobby: `${DRAFT_DESK}?demo`,
  room: `${DRAFT_DESK}/${demoSlug(id)}`,
  recap: `${DRAFT_DESK}/${demoSlug(id)}/recap`,
});

// ---------------------------------------------------------------------------
// Live
// ---------------------------------------------------------------------------

export function useLiveRoom(sessionId: number): RoomModel {
  const { isSignedIn, isLoaded } = useAuth();
  const session = useDraftSessionQuery(sessionId);
  const board = useDraftBoardQuery(sessionId);
  const addPick = useDraftPickMutation(sessionId);
  const undoPick = useUndoDraftPickMutation(sessionId);
  const updateSession = useUpdateDraftSessionMutation(sessionId);
  const advanceMock = useMockAdvanceMutation(sessionId);

  // A room follows exactly one ESPN draft: a live room is linked at creation,
  // a mock room links to the first ESPN room the user accepts, a manual room follows none.
  const s = session.data;
  const sync = useEspnDraftSync({
    sessionId,
    session: s,
    board: board.data,
    expectedLeagueId: s?.espn_league_id ?? null,
    bindable: s?.kind === "mock" && s.espn_league_id == null,
    enabled: Boolean(s && s.status === "active" && s.kind !== "manual"),
  });

  let status: RoomModel["status"] = "ready";
  let message: string | null = null;
  if (!isLoaded) status = "loading";
  else if (!isSignedIn) status = "signed-out";
  else if (session.isLoading) status = "loading";
  else if (session.error) {
    status = "error";
    message = userMessage(session.error, "This draft room could not be loaded.");
  }

  const refetchSession = session.refetch;
  const refetchBoard = board.refetch;
  return {
    demo: false,
    status,
    message,
    session: s ?? null,
    board: board.data ?? null,
    boardLoading: board.isLoading,
    boardError: board.error ? userMessage(board.error, "The board could not be loaded.") : null,
    pick: addPick.mutateAsync,
    picking: addPick.isPending,
    undo: async (overall) => {
      await undoPick.mutateAsync(overall);
    },
    undoing: undoPick.isPending,
    advance: advanceMock.mutateAsync,
    advancing: advanceMock.isPending,
    update: updateSession.mutateAsync,
    updating: updateSession.isPending,
    sync,
    refetch: () => {
      void refetchSession();
      void refetchBoard();
    },
    hrefs: liveHrefs(sessionId),
  };
}

export function useLiveRecap(sessionId: number): RecapModel {
  const { isSignedIn, isLoaded } = useAuth();
  const session = useDraftSessionQuery(sessionId);
  const recap = useDraftRecapQuery(sessionId);
  let status: RecapModel["status"] = "ready";
  let message: string | null = null;
  if (!isLoaded) status = "loading";
  else if (!isSignedIn) status = "signed-out";
  else if (session.isLoading) status = "loading";
  else if (session.error || recap.error) {
    status = "error";
    message = userMessage(session.error ?? recap.error, "The recap could not be loaded.");
  }
  return {
    demo: false,
    status,
    message,
    session: session.data ?? null,
    recap: recap.data ?? null,
    recapLoading: recap.isLoading,
    refetch: () => {
      void session.refetch();
      void recap.refetch();
    },
    hrefs: liveHrefs(sessionId),
  };
}

function teamChoices(teams: ReturnType<typeof useSelectedTeam>["teams"]): TeamChoice[] {
  return teams.map((t) => {
    const provider = t.league_info?.provider ?? "espn";
    const format = t.league?.scoring_type === "categories" ? "CATS" : t.league?.scoring_type === "roto" ? "ROTO" : "PTS";
    return {
      id: t.team_id,
      name: t.league_info?.team_name ?? `Team ${t.team_id}`,
      tag: `${provider.toUpperCase()} · ${format}`,
      espn: provider === "espn",
    };
  });
}

export function useLiveLobby(selectedId: number | null, select: (id: number | null) => void): LobbyModel {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const queryClient = useQueryClient();
  const list = useDraftSessionsQuery();
  const detail = useDraftSessionQuery(selectedId);
  const selectedTeam = useSelectedTeam();
  const createSession = useCreateDraftSessionMutation();
  const createSilently = useCreateDraftSessionMutation({ silent: true });
  const deleteSession = useDeleteDraftSessionMutation();
  const deleteSilently = useDeleteDraftSessionMutation({ silent: true });
  const importDraft = useDraftImportMutation();

  let status: LobbyModel["status"] = "ready";
  let message: string | null = null;
  if (!isLoaded) status = "loading";
  else if (!isSignedIn) status = "signed-out";
  else if (list.isLoading) status = "loading";
  else if (list.error) {
    status = "error";
    message = userMessage(list.error, "Your draft rooms could not be loaded.");
  }

  // The update hook is bound to one session; renames and finishes go straight to the client.
  const update = useCallback(
    async (id: number, body: DraftSessionUpdate) => {
      const session = await apiClient.updateDraftSession(getToken, id, body);
      queryClient.setQueryData(draftKeys.detail(id), session);
      void queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: draftKeys.recap(id) });
    },
    [getToken, queryClient]
  );

  const rooms = list.data ?? [];
  return {
    demo: false,
    status,
    message,
    rooms,
    selectedId,
    select,
    selected: detail.data ?? null,
    hrefFor: (id, view = "room") => (view === "recap" ? liveHrefs(id).recap : liveHrefs(id).room),
    teams: teamChoices(selectedTeam.teams),
    selectedTeamId: selectedTeam.teamId,
    create: createSession.mutateAsync,
    creating: createSession.isPending,
    rename: async (id, name) => {
      try {
        await update(id, { name });
      } catch (err) {
        toast.error(userMessage(err, "The room could not be renamed"));
        throw err;
      }
    },
    finish: async (id) => {
      try {
        await update(id, { status: "completed" });
        toast.success("Draft finished");
      } catch (err) {
        toast.error(userMessage(err, "The draft could not be finished"));
        throw err;
      }
    },
    remove: async (id) => {
      await deleteSession.mutateAsync(id);
      if (selectedId === id) select(null);
    },
    // Import: open a room for the team, fold the finished ESPN draft into it.
    // A refusal leaves an empty room behind, which is removed again; a lost
    // response may have finished on the server, so that room is kept.
    importDraft: async (teamId, name) => {
      const session = await createSilently.mutateAsync({ name, team_id: teamId, kind: "import", keepers: [] });
      try {
        const result = await importDraft.mutateAsync(session.id);
        return result.session;
      } catch (err) {
        const failure = importFailure(err);
        if (!failure.outcomeUnknown) await deleteSilently.mutateAsync(session.id).catch(() => undefined);
        // A lost response may have finished on the server: the dialog points at the room it kept.
        throw failure.outcomeUnknown ? Object.assign(err as object, { keptSessionId: session.id }) : err;
      }
    },
    reset: null,
    refetch: () => void list.refetch(),
  };
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

function refuse(err: unknown): never {
  toast.error(err instanceof DemoRefusal ? err.message : "That could not be done");
  throw err;
}

export function useDemoRoom(id: number): RoomModel {
  const fixtures = useDemoFixtures();
  const ready = useDemoReady(fixtures.points);
  const room = useDemoDrafts((s) => s.rooms.find((r) => r.id === id) ?? null);
  const put = useDemoDrafts((s) => s.put);
  const boardSource = useDraftRoomStore((s) => s.boardSource);
  const fixture = room ? fixtures[room.format] : null;

  const session = useMemo(() => (room && fixture ? demoSession(room, fixture) : null), [room, fixture]);
  const board = useMemo(() => (room && fixture ? demoBoard(room, fixture, boardSource) : null), [room, fixture, boardSource]);

  // Writes read the store at call time, so two quick ones never act on a stale room.
  const current = useCallback((): DemoRoom => {
    const r = useDemoDrafts.getState().rooms.find((x) => x.id === id);
    if (!r) throw new DemoRefusal("This demo room is gone");
    return r;
  }, [id]);

  const status: RoomModel["status"] = !ready || (room && !fixture) ? "loading" : room ? "ready" : "error";
  return {
    demo: true,
    status,
    message: status === "error" ? "This demo room does not exist (any more). The lobby has the others." : null,
    session,
    board,
    boardLoading: false,
    boardError: null,
    pick: async (body) => {
      try {
        const r = current();
        const fx = fixtures[r.format]!;
        const { room: next, overall } = demoPick(r, fx, body);
        put(next);
        return demoSession(next, fx).picks.find((p) => p.overall_pick === overall)!;
      } catch (err) {
        refuse(err);
      }
    },
    picking: false,
    undo: async (overall) => {
      try {
        put(demoUndo(current(), overall));
      } catch (err) {
        refuse(err);
      }
    },
    undoing: false,
    advance: async (until) => {
      try {
        const r = current();
        const { room: next, result } = demoAdvance(r, fixtures[r.format]!, until);
        put(next);
        return result;
      } catch (err) {
        refuse(err);
      }
    },
    advancing: false,
    update: async (body) => {
      const r = current();
      const next: DemoRoom = {
        ...r,
        name: body.name !== undefined ? body.name || null : r.name,
        mySlot: body.my_slot !== undefined ? body.my_slot : r.mySlot,
        punts: body.punts ?? r.punts,
        keepers: body.keepers ?? r.keepers,
        status: body.status ?? r.status,
        updatedAt: Date.now(),
      };
      put(next);
      return demoSession(next, fixtures[r.format]!);
    },
    updating: false,
    sync: null,
    refetch: () => undefined,
    hrefs: demoHrefs(id),
  };
}

export function useDemoRecap(id: number): RecapModel {
  const fixtures = useDemoFixtures();
  const ready = useDemoReady(fixtures.points);
  const room = useDemoDrafts((s) => s.rooms.find((r) => r.id === id) ?? null);
  const fixture = room ? fixtures[room.format] : null;
  const session = useMemo(() => (room && fixture ? demoSession(room, fixture) : null), [room, fixture]);
  const recap = useMemo(() => (room && fixture ? demoRecap(room, fixture) : null), [room, fixture]);
  const status: RecapModel["status"] = !ready || (room && !fixture) ? "loading" : room ? "ready" : "error";
  return {
    demo: true,
    status,
    message: status === "error" ? "This demo room does not exist (any more). The lobby has the others." : null,
    session,
    recap,
    recapLoading: false,
    refetch: () => undefined,
    hrefs: demoHrefs(id),
  };
}

export function useDemoLobby(selectedId: number | null, select: (id: number | null) => void): LobbyModel {
  const fixtures = useDemoFixtures();
  const ready = useDemoReady(fixtures.points);
  const rooms = useDemoDrafts((s) => s.rooms);
  const store = useDemoDrafts();
  const sessions = useMemo<DraftSession[]>(
    () =>
      ready
        ? rooms.flatMap((r) => (fixtures[r.format] ? [demoSession(r, fixtures[r.format]!)] : []))
        : [],
    [ready, rooms, fixtures]
  );
  return {
    demo: true,
    status: ready && fixtures.points && fixtures.categories ? "ready" : "loading",
    message: null,
    rooms: sessions,
    selectedId,
    select,
    selected: sessions.find((s) => s.id === selectedId) ?? null,
    hrefFor: (id, view = "room") => (view === "recap" ? demoHrefs(id).recap : demoHrefs(id).room),
    teams: [],
    selectedTeamId: null,
    create: async (body) => {
      const size = body.pick_order?.length ?? 10;
      const room = store.create({
        format: body.scoring_format === "categories" ? "categories" : "points",
        size,
        rounds: body.rounds ?? 13,
        mySlot: body.my_slot ?? null,
        name: body.name ?? null,
      });
      return demoSession(room, fixtures[room.format]!);
    },
    creating: false,
    rename: async (id, name) => {
      const r = rooms.find((x) => x.id === id);
      if (r) store.put({ ...r, name, updatedAt: Date.now() });
    },
    finish: async (id) => {
      const r = rooms.find((x) => x.id === id);
      if (r) store.put({ ...r, status: "completed", updatedAt: Date.now() });
      toast.success("Draft finished");
    },
    remove: async (id) => {
      store.remove(id);
      if (selectedId === id) select(null);
      toast.success("Demo room deleted");
    },
    importDraft: null,
    reset: () => {
      store.reset();
      select(null);
    },
    refetch: () => undefined,
  };
}
