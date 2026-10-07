import type { EspnDraftSync } from "@/hooks/useEspnDraftSync";
import type {
  DraftBoardResult,
  DraftKind,
  DraftPick,
  DraftPickCreate,
  DraftRecapResult,
  DraftSession,
  DraftSessionCreate,
  DraftSessionUpdate,
  MockAdvance,
  MockUntil,
} from "@/types/draft";

export type ModelStatus = "loading" | "signed-out" | "error" | "ready";

/**
 * Everything a draft room needs from outside: the session, its board, and the
 * writes. The live room reads and writes the API (and the Draft Tap); the demo
 * runs the same draft in the browser. Writes reject on failure after the model
 * has said why (a toast), so callers only report success.
 */
export interface RoomModel {
  demo: boolean;
  status: ModelStatus;
  /** Why the room could not load, for the error state. */
  message: string | null;
  session: DraftSession | null;
  board: DraftBoardResult | null;
  boardLoading: boolean;
  boardError: string | null;
  pick: (body: DraftPickCreate) => Promise<DraftPick>;
  picking: boolean;
  undo: (overall: number) => Promise<void>;
  undoing: boolean;
  advance: (until: NonNullable<MockUntil>) => Promise<MockAdvance>;
  advancing: boolean;
  update: (body: DraftSessionUpdate) => Promise<DraftSession>;
  updating: boolean;
  /** The Draft Tap, for a room that follows an ESPN draft; null in the demo. */
  sync: EspnDraftSync | null;
  refetch: () => void;
  hrefs: { lobby: string; room: string; recap: string };
}

export interface RecapModel {
  demo: boolean;
  status: ModelStatus;
  message: string | null;
  session: DraftSession | null;
  recap: DraftRecapResult | null;
  recapLoading: boolean;
  refetch: () => void;
  hrefs: { lobby: string; room: string; recap: string };
}

export interface TeamChoice {
  id: number;
  name: string;
  /** "ESPN · PTS" */
  tag: string;
  espn: boolean;
}

export interface LobbyModel {
  demo: boolean;
  status: ModelStatus;
  message: string | null;
  rooms: DraftSession[];
  selectedId: number | null;
  select: (id: number | null) => void;
  /** The selected room with its picks (the list carries none); null while it loads. */
  selected: DraftSession | null;
  hrefFor: (id: number, view?: "room" | "recap") => string;
  teams: TeamChoice[];
  selectedTeamId: number | null;
  create: (body: DraftSessionCreate) => Promise<DraftSession>;
  creating: boolean;
  rename: (id: number, name: string | null) => Promise<void>;
  finish: (id: number) => Promise<void>;
  remove: (id: number) => Promise<void>;
  /** Fold a finished ESPN draft into a new room (live only). */
  importDraft: ((teamId: number, name: string | null) => Promise<DraftSession>) | null;
  reset: (() => void) | null;
  refetch: () => void;
}

/** The new-room form's "No league — generic settings". */
export const NO_TEAM = 0;

/**
 * Where the new-room form starts: on the selected team when it is one of
 * yours, following that league's ESPN draft when it is an ESPN league, else on
 * no league as a mock. Plain values on purpose: the dialog resets when they
 * change, and the lobby hands it a freshly built team list on every render.
 */
export function createFormStart(teams: readonly TeamChoice[], selectedTeamId: number | null): { teamId: number; kind: DraftKind } {
  const preferred = teams.find((t) => t.id === selectedTeamId);
  return { teamId: preferred?.id ?? NO_TEAM, kind: preferred?.espn ? "live" : "mock" };
}

/** Where the import form starts: the selected team when it can be imported, else the first that can. */
export function importFormStart(teams: readonly TeamChoice[], selectedTeamId: number | null): number | null {
  return (teams.find((t) => t.id === selectedTeamId) ?? teams[0])?.id ?? null;
}

/**
 * Where R and Escape lead from a recap, and what the status line calls it:
 * back to the room, or to the lobby for an imported draft, which has no room.
 */
export function recapExit(kind: DraftKind | null | undefined, hrefs: RecapModel["hrefs"]): { href: string; label: string } {
  return kind === "import" ? { href: hrefs.lobby, label: "all rooms" } : { href: hrefs.room, label: "back to the room" };
}
