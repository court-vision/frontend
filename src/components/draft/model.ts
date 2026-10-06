import type { EspnDraftSync } from "@/hooks/useEspnDraftSync";
import type {
  DraftBoardResult,
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
