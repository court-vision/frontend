/**
 * What the Account desk reads and writes, behind one interface the live API
 * and the demo both implement. The desk's components never fetch: they ask
 * the model, so the demo and the real thing render the same code.
 */
import type { EspnAccountTeam, ProviderConnection } from "@/types/connections";
import type { NotificationPreference, NotificationTeamPreference, NotificationTeamPreferenceRequest } from "@/types/notifications";
import type { LeagueDetail, LeagueInfoRequest, ScoringPreview, TeamResponseData } from "@/types/team";
import type { YahooLeague, YahooTeam } from "@/types/yahoo";

export type ModelStatus = "loading" | "signed-out" | "ready" | "error";

/** A read, as a component sees it. */
export interface Loaded<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface ConnectResult {
  connection: ProviderConnection;
  created: boolean;
  /** The backend's own line: connected, cookies updated, unconfirmed, how many teams were linked. */
  message: string;
}

export interface AddedTeam {
  teamId: number;
  alreadyExists: boolean;
  team: TeamResponseData | null;
}

/**
 * What adding a team needs. The Week desk carries this much too, so a team
 * can be added from where it is wanted.
 */
export interface AddTeamModel {
  demo: boolean;
  connections: ProviderConnection[];
  /** The season under way, as "2026-27". */
  seasonKey: string;
  /** Save an ESPN account's cookies (checked against ESPN first). Throws with the refusal. */
  connectEspn: (body: { espn_s2: string; swid: string }) => Promise<ConnectResult>;
  /** The teams ESPN lists on a connected account. A hook: call it unconditionally. */
  useAccountTeams: (connectionId: number | null) => Loaded<EspnAccountTeam[]>;
  addTeam: (body: LeagueInfoRequest) => Promise<AddedTeam>;
  /** Leaves for Yahoo's sign-in; the page comes back to `returnTo`. Resolves only when leaving failed. */
  startYahoo: (returnTo: string) => Promise<void>;
  useYahooLeagues: (connectionId: number | null) => Loaded<YahooLeague[]>;
  useYahooTeams: (connectionId: number | null, leagueKey: string | null) => Loaded<YahooTeam[]>;
}

export interface AccountUser {
  name: string | null;
  email: string | null;
  imageUrl: string | null;
}

export interface AccountModel extends AddTeamModel {
  status: ModelStatus;
  message: string | null;
  teams: TeamResponseData[];
  selectedTeamId: number | null;
  selectTeam: (id: number | null) => void;
  refetch: () => void;

  // ---- teams
  useLeague: (teamId: number | null) => Loaded<LeagueDetail>;
  syncLeague: (teamId: number) => Promise<void>;
  /** The team whose league is being re-read, while it is. */
  syncing: number | null;
  setPreview: (team: TeamResponseData, preview: ScoringPreview | null) => Promise<void>;
  /** Point a team at a connected account's credentials. */
  linkTeam: (team: TeamResponseData, connectionId: number) => Promise<void>;
  removeTeam: (teamId: number) => Promise<void>;

  // ---- connections
  verify: (connectionId: number) => Promise<ProviderConnection | null>;
  verifying: number | null;
  disconnect: (connectionId: number) => Promise<void>;

  // ---- lineup alerts
  usePrefs: () => Loaded<NotificationPreference>;
  savePrefs: (prefs: NotificationPreference) => Promise<void>;
  useTeamPrefs: () => Loaded<NotificationTeamPreference[]>;
  saveTeamPrefs: (teamId: number, data: NotificationTeamPreferenceRequest) => Promise<void>;
  clearTeamPrefs: (teamId: number) => Promise<void>;

  // ---- the account itself
  user: AccountUser | null;
  signOut: () => void;
  /** Clerk's own profile dialog, when there is a signed-in account. */
  openProfile: (() => void) | null;
}
