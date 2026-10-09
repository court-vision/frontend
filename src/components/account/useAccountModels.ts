"use client";

import { useCallback, useMemo, useState } from "react";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { toast } from "sonner";
import { create } from "zustand";
import { useConnectEspnMutation, useConnectionsQuery, useDeleteConnectionMutation, useEspnAccountTeamsQuery, useVerifyConnectionMutation } from "@/hooks/useConnections";
import {
  useDeleteTeamPreferenceMutation,
  useNotificationPreferencesQuery,
  useTeamNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  useUpsertTeamPreferenceMutation,
} from "@/hooks/useNotificationPreferences";
import { useSeason } from "@/hooks/useSeason";
import { teamsKeys, useAddTeamMutation, useDeleteTeamMutation, useSyncTeamLeagueMutation, useTeamLeagueQuery, useTeamsQuery, useUpdateTeamMutation } from "@/hooks/useTeams";
import { useYahooLeagues, useYahooTeams } from "@/hooks/useYahoo";
import { apiClient } from "@/lib/api";
import { userMessage } from "@/lib/api-error";
import {
  DEMO_ACCOUNT_TEAMS,
  DEMO_CONNECTIONS,
  DEMO_PREFS,
  DEMO_TEAMS,
  DEMO_TEAM_PREFS,
  DEMO_USER,
  DEMO_YAHOO_LEAGUES,
  DEMO_YAHOO_TEAMS,
  demoLeagueDetail,
} from "@/lib/account-demo";
import { useUIStore } from "@/stores/useUIStore";
import type { EspnAccountTeam, ProviderConnection } from "@/types/connections";
import type { NotificationPreference, NotificationTeamPreference, NotificationTeamPreferenceRequest } from "@/types/notifications";
import type { LeagueDetail, LeagueInfoRequest, TeamResponseData } from "@/types/team";
import type { YahooLeague, YahooTeam } from "@/types/yahoo";
import type { AccountModel, AddTeamModel, Loaded, ModelStatus } from "./model";

function loaded<T>(q: UseQueryResult<T | null>): Loaded<NonNullable<T>> {
  return {
    data: (q.data as NonNullable<T> | null | undefined) ?? null,
    loading: q.isLoading,
    error: q.error ? userMessage(q.error) : null,
    refetch: () => void q.refetch(),
  };
}

// ---------------------------------------------------------------------------
// Live: the API, through the shared hooks
// ---------------------------------------------------------------------------

const useLiveLeague = (teamId: number | null): Loaded<LeagueDetail> => loaded(useTeamLeagueQuery(teamId));
const useLiveAccountTeams = (connectionId: number | null): Loaded<EspnAccountTeam[]> => loaded(useEspnAccountTeamsQuery(connectionId));
const useLiveYahooLeagues = (connectionId: number | null): Loaded<YahooLeague[]> => loaded(useYahooLeagues(connectionId));
const useLiveYahooTeams = (connectionId: number | null, leagueKey: string | null): Loaded<YahooTeam[]> => loaded(useYahooTeams(connectionId, leagueKey));
const useLivePrefs = (): Loaded<NotificationPreference> => loaded(useNotificationPreferencesQuery());
const useLiveTeamPrefs = (): Loaded<NotificationTeamPreference[]> => loaded(useTeamNotificationPreferencesQuery());

/** The add-team flow's needs, from the API. The Week desk uses this on its own. */
export function useLiveAddTeam(): AddTeamModel {
  const { getToken } = useAuth();
  const connections = useConnectionsQuery();
  const season = useSeason();
  const connect = useConnectEspnMutation();
  const add = useAddTeamMutation({ silent: true });
  const connectAsync = connect.mutateAsync;
  const addAsync = add.mutateAsync;

  const connectEspn = useCallback(
    async (body: { espn_s2: string; swid: string }) => {
      const res = await connectAsync(body);
      if (!res.data) throw new Error(res.message || "ESPN did not answer");
      return { connection: res.data, created: !!res.created, message: res.message };
    },
    [connectAsync]
  );
  const addTeam = useCallback(
    async (body: LeagueInfoRequest) => {
      const res = await addAsync(body);
      if (res.status !== "success") throw new Error(res.message || "The team was not added");
      const teamId = res.team_id ?? res.data?.team_id;
      if (teamId == null) throw new Error("The team was not added");
      return { teamId, alreadyExists: !!res.already_exists, team: res.data ?? null };
    },
    [addAsync]
  );
  const startYahoo = useCallback(
    async (returnTo: string) => {
      const url = await apiClient.getYahooAuthUrl(getToken, returnTo);
      window.location.assign(url);
    },
    [getToken]
  );

  return useMemo(
    () => ({
      demo: false,
      connections: connections.data ?? [],
      seasonKey: season.key,
      connectEspn,
      useAccountTeams: useLiveAccountTeams,
      addTeam,
      startYahoo,
      useYahooLeagues: useLiveYahooLeagues,
      useYahooTeams: useLiveYahooTeams,
    }),
    [connections.data, season.key, connectEspn, addTeam, startYahoo]
  );
}

export function useLiveAccount(): AccountModel {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const queryClient = useQueryClient();
  const selectedTeamId = useUIStore((s) => s.selectedTeam);
  const setSelectedTeam = useUIStore((s) => s.setSelectedTeam);
  const teams = useTeamsQuery();
  const connections = useConnectionsQuery();
  const addTeamModel = useLiveAddTeam();

  const update = useUpdateTeamMutation();
  const remove = useDeleteTeamMutation();
  const sync = useSyncTeamLeagueMutation();
  const verify = useVerifyConnectionMutation();
  const disconnect = useDeleteConnectionMutation();
  const savePrefs = useUpdateNotificationPreferencesMutation();
  const saveTeamPrefs = useUpsertTeamPreferenceMutation();
  const clearTeamPrefs = useDeleteTeamPreferenceMutation();

  let status: ModelStatus = "ready";
  let message: string | null = null;
  if (!isLoaded) status = "loading";
  else if (!isSignedIn) status = "signed-out";
  else if (teams.isLoading || connections.isLoading) status = "loading";
  else if (teams.error) {
    status = "error";
    message = userMessage(teams.error, "Your teams could not be loaded.");
  } else if (connections.error) {
    status = "error";
    message = userMessage(connections.error, "Your connections could not be loaded.");
  }

  const updateAsync = update.mutateAsync;
  const removeAsync = remove.mutateAsync;
  const syncAsync = sync.mutateAsync;
  const verifyAsync = verify.mutateAsync;
  const disconnectAsync = disconnect.mutateAsync;
  const savePrefsAsync = savePrefs.mutateAsync;
  const saveTeamPrefsAsync = saveTeamPrefs.mutateAsync;
  const clearTeamPrefsAsync = clearTeamPrefs.mutateAsync;

  /** The update route wants the whole league_info back; blanks keep what is stored. */
  const updateTeam = useCallback(
    async (team: TeamResponseData, patch: Partial<LeagueInfoRequest>) => {
      const info = team.league_info;
      const res = await updateAsync({
        teamId: team.team_id,
        teamData: {
          provider: info.provider,
          league_id: info.league_id,
          team_name: info.team_name,
          league_name: info.league_name ?? undefined,
          year: info.year,
          scoring_preview: info.scoring_preview ?? null,
          yahoo_team_key: info.yahoo_team_key ?? undefined,
          ...patch,
        },
      });
      if (res.status !== "success") throw new Error(res.message || "The team was not updated");
    },
    [updateAsync]
  );

  const model: AccountModel = {
    ...addTeamModel,
    status,
    message,
    teams: teams.data ?? [],
    selectedTeamId,
    selectTeam: setSelectedTeam,
    refetch: () => {
      void teams.refetch();
      void connections.refetch();
    },
    useLeague: useLiveLeague,
    syncLeague: async (teamId) => {
      await syncAsync(teamId);
    },
    syncing: sync.isPending ? (sync.variables ?? null) : null,
    setPreview: (team, preview) => updateTeam(team, { scoring_preview: preview }),
    linkTeam: async (team, connectionId) => {
      await updateTeam(team, team.league_info.provider === "yahoo" ? { yahoo_connection_id: connectionId } : { espn_connection_id: connectionId });
      void queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
    },
    removeTeam: async (teamId) => {
      const res = await removeAsync(teamId);
      if (res.status !== "success") throw new Error(res.message || "The team was not removed");
    },
    verify: async (connectionId) => {
      const res = await verifyAsync(connectionId);
      return res.data ?? null;
    },
    verifying: verify.isPending ? (verify.variables ?? null) : null,
    disconnect: async (connectionId) => {
      await disconnectAsync(connectionId);
    },
    usePrefs: useLivePrefs,
    savePrefs: async (prefs) => {
      await savePrefsAsync(prefs);
    },
    useTeamPrefs: useLiveTeamPrefs,
    saveTeamPrefs: async (teamId, data) => {
      await saveTeamPrefsAsync({ teamId, data });
    },
    clearTeamPrefs: async (teamId) => {
      await clearTeamPrefsAsync(teamId);
    },
    user: isSignedIn
      ? {
          name: user?.fullName ?? user?.firstName ?? null,
          email: user?.primaryEmailAddress?.emailAddress ?? null,
          imageUrl: user?.hasImage ? (user.imageUrl ?? null) : null,
        }
      : null,
    signOut: () => void clerk.signOut({ redirectUrl: "/" }),
    openProfile: isSignedIn ? () => clerk.openUserProfile() : null,
  };
  return model;
}

// ---------------------------------------------------------------------------
// Demo: a made-up account, every write in memory
// ---------------------------------------------------------------------------

interface DemoState {
  teams: TeamResponseData[];
  connections: ProviderConnection[];
  accountTeams: EspnAccountTeam[];
  prefs: NotificationPreference;
  teamPrefs: NotificationTeamPreference[];
  selectedTeamId: number | null;
  nextTeamId: number;
  set: (patch: Partial<DemoState> | ((s: DemoState) => Partial<DemoState>)) => void;
}

const useDemoStore = create<DemoState>()((set) => ({
  teams: DEMO_TEAMS,
  connections: DEMO_CONNECTIONS,
  accountTeams: DEMO_ACCOUNT_TEAMS,
  prefs: DEMO_PREFS,
  teamPrefs: DEMO_TEAM_PREFS,
  selectedTeamId: 1,
  nextTeamId: 4,
  set: (patch) => set(patch),
}));

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ready = <T,>(data: T | null): Loaded<T> => ({ data, loading: false, error: null, refetch: () => {} });

const useDemoLeague = (teamId: number | null): Loaded<LeagueDetail> => {
  const teams = useDemoStore((s) => s.teams);
  return useMemo(() => ready<LeagueDetail>(teamId != null ? demoLeagueDetail(teamId, teams) : null), [teamId, teams]);
};
const useDemoAccountTeams = (connectionId: number | null): Loaded<EspnAccountTeam[]> => {
  const list = useDemoStore((s) => s.accountTeams);
  return useMemo(() => ready(connectionId === 1 ? list : []), [connectionId, list]);
};
const useDemoYahooLeagues = (connectionId: number | null): Loaded<YahooLeague[]> =>
  useMemo(() => ready(connectionId != null ? DEMO_YAHOO_LEAGUES : []), [connectionId]);
const useDemoYahooTeams = (connectionId: number | null, leagueKey: string | null): Loaded<YahooTeam[]> =>
  useMemo(() => ready(connectionId != null && leagueKey ? (DEMO_YAHOO_TEAMS[leagueKey] ?? []) : []), [connectionId, leagueKey]);
const useDemoPrefs = (): Loaded<NotificationPreference> => ready(useDemoStore((s) => s.prefs));
const useDemoTeamPrefs = (): Loaded<NotificationTeamPreference[]> => ready(useDemoStore((s) => s.teamPrefs));

/** A connected ESPN account's teams, with one of them now tracked. */
function trackOnAccount(list: EspnAccountTeam[], leagueId: number, teamName: string, teamId: number): EspnAccountTeam[] {
  return list.map((t) => (t.league_id === leagueId && t.team_name === teamName ? { ...t, tracked_team_id: teamId } : t));
}

function demoTeam(id: number, body: LeagueInfoRequest, connectionId: number | null): TeamResponseData {
  const yahoo = body.provider === "yahoo";
  const base = DEMO_TEAMS[yahoo ? 2 : 0];
  return {
    team_id: id,
    league_info: {
      provider: yahoo ? "yahoo" : "espn",
      league_id: body.league_id,
      team_name: body.team_name,
      league_name: body.league_name ?? null,
      year: body.year,
      yahoo_team_key: body.yahoo_team_key ?? null,
      espn_team_id: null,
      scoring_preview: body.scoring_preview ?? null,
      has_espn_credentials: !yahoo && connectionId != null,
      has_yahoo_credentials: yahoo,
    },
    league: null,
    capabilities: base.capabilities,
  };
}

export function useDemoAddTeam(): AddTeamModel {
  const connections = useDemoStore((s) => s.connections);
  const set = useDemoStore((s) => s.set);
  const [, setBusy] = useState(false);

  const connectEspn = useCallback(
    async (body: { espn_s2: string; swid: string }) => {
      setBusy(true);
      await wait(700);
      setBusy(false);
      if (body.swid.replace(/[{}\s]/g, "").toUpperCase().endsWith("BAD")) {
        throw new Error("ESPN rejected these cookies — copy espn_s2 and SWID again while logged in to ESPN (demo: a SWID ending in BAD is refused)");
      }
      const existing = connections.find((c) => c.provider === "espn");
      const now = new Date().toISOString();
      const connection: ProviderConnection = existing
        ? { ...existing, status: "ok", verified_at: now, auth_failed_at: null, updated_at: now }
        : { id: 3, provider: "espn", account_hint: `…${body.swid.replace(/[{}\s]/g, "").slice(-4).toUpperCase()}`, status: "ok", verified_at: now, auth_failed_at: null, created_at: now, updated_at: now, teams: [] };
      set((s) => ({ connections: existing ? s.connections.map((c) => (c.id === connection.id ? connection : c)) : [...s.connections, connection] }));
      return { connection, created: !existing, message: existing ? "ESPN cookies updated (demo)" : "ESPN account connected (demo)" };
    },
    [connections, set]
  );

  const addTeam = useCallback(async (body: LeagueInfoRequest) => {
    await wait(500);
    const s = useDemoStore.getState();
    const dup = s.teams.find((t) => t.league_info.league_id === body.league_id && t.league_info.team_name === body.team_name);
    if (dup) return { teamId: dup.team_id, alreadyExists: true, team: dup };
    if (body.provider !== "yahoo" && body.espn_connection_id == null && !body.espn_s2 && body.team_name.toLowerCase().includes("private")) {
      throw new Error("This ESPN league is private and no credentials were sent — connect the ESPN account first (demo)");
    }
    const connectionId = body.provider === "yahoo" ? (body.yahoo_connection_id ?? null) : (body.espn_connection_id ?? null);
    const team = demoTeam(s.nextTeamId, body, connectionId);
    const row = { team_id: team.team_id, team_name: body.team_name, league_name: body.league_name ?? null, league_id: body.league_id, year: body.year };
    s.set({
      teams: [...s.teams, team],
      nextTeamId: s.nextTeamId + 1,
      selectedTeamId: team.team_id,
      connections: s.connections.map((c) => (c.id === connectionId ? { ...c, teams: [...c.teams, row] } : c)),
      accountTeams: connectionId === 1 ? trackOnAccount(s.accountTeams, body.league_id, body.team_name, team.team_id) : s.accountTeams,
      teamPrefs: [...s.teamPrefs, { team_id: team.team_id, has_override: false, lineup_alerts_enabled: null, alert_benched_starters: null, alert_active_non_playing: null, alert_injured_active: null, alert_minutes_before: null, auto_lineup_enabled: null, email: null }],
    });
    toast.success(`${body.team_name} added (demo)`);
    return { teamId: team.team_id, alreadyExists: false, team };
  }, []);

  const startYahoo = useCallback(async (returnTo: string) => {
    await wait(600);
    const joiner = returnTo.includes("?") ? "&" : "?";
    window.location.assign(`${returnTo}${joiner}demo&yahoo_connected=true&yahoo_connection=2`);
  }, []);

  return useMemo(
    () => ({
      demo: true,
      connections,
      seasonKey: "2026-27",
      connectEspn,
      useAccountTeams: useDemoAccountTeams,
      addTeam,
      startYahoo,
      useYahooLeagues: useDemoYahooLeagues,
      useYahooTeams: useDemoYahooTeams,
    }),
    [connections, connectEspn, addTeam, startYahoo]
  );
}

export function useDemoAccount(): AccountModel {
  const state = useDemoStore();
  const addTeamModel = useDemoAddTeam();
  const [syncing, setSyncing] = useState<number | null>(null);
  const [verifying, setVerifying] = useState<number | null>(null);
  const set = state.set;

  return {
    ...addTeamModel,
    status: "ready",
    message: null,
    teams: state.teams,
    selectedTeamId: state.selectedTeamId,
    selectTeam: (id) => set({ selectedTeamId: id }),
    refetch: () => {},
    useLeague: useDemoLeague,
    syncLeague: async (teamId) => {
      setSyncing(teamId);
      await wait(800);
      setSyncing(null);
      set((s) => ({
        teams: s.teams.map((t) =>
          t.team_id === teamId
            ? {
                ...t,
                league: t.league
                  ? { ...t.league, settings_synced: true, settings_synced_at: new Date().toISOString() }
                  : { ...DEMO_TEAMS[0].league!, id: 90 + teamId, provider: t.league_info.provider, provider_league_id: String(t.league_info.league_id), season: t.league_info.year, name: t.league_info.league_name, settings_synced_at: new Date().toISOString() },
              }
            : t
        ),
      }));
      toast.success("League settings synced (demo)");
    },
    syncing,
    setPreview: async (team, preview) => {
      await wait(300);
      set((s) => ({
        teams: s.teams.map((t) =>
          t.team_id === team.team_id
            ? { ...t, league_info: { ...t.league_info, scoring_preview: preview }, league: t.league ? { ...t.league, scoring_preview: preview } : t.league }
            : t
        ),
      }));
      toast.success(preview ? `Shown as a ${preview} league (demo)` : "Shown as its real format (demo)");
    },
    linkTeam: async (team, connectionId) => {
      await wait(400);
      const row = { team_id: team.team_id, team_name: team.league_info.team_name, league_name: team.league_info.league_name, league_id: team.league_info.league_id, year: team.league_info.year };
      set((s) => ({
        connections: s.connections.map((c) => (c.id === connectionId ? { ...c, teams: [...c.teams.filter((x) => x.team_id !== team.team_id), row] } : { ...c, teams: c.teams.filter((x) => x.team_id !== team.team_id) })),
        teams: s.teams.map((t) => (t.team_id === team.team_id ? { ...t, league_info: { ...t.league_info, has_espn_credentials: true } } : t)),
      }));
      toast.success("Team linked to the account (demo)");
    },
    removeTeam: async (teamId) => {
      await wait(400);
      set((s) => ({
        teams: s.teams.filter((t) => t.team_id !== teamId),
        connections: s.connections.map((c) => ({ ...c, teams: c.teams.filter((x) => x.team_id !== teamId) })),
        accountTeams: s.accountTeams.map((t) => (t.tracked_team_id === teamId ? { ...t, tracked_team_id: null } : t)),
        selectedTeamId: s.selectedTeamId === teamId ? (s.teams.find((t) => t.team_id !== teamId)?.team_id ?? null) : s.selectedTeamId,
      }));
      toast.success("Team removed (demo)");
    },
    verify: async (connectionId) => {
      setVerifying(connectionId);
      await wait(900);
      setVerifying(null);
      const now = new Date().toISOString();
      let out: ProviderConnection | null = null;
      set((s) => ({
        connections: s.connections.map((c) => {
          if (c.id !== connectionId) return c;
          out = { ...c, status: "ok", verified_at: now, auth_failed_at: null };
          return out;
        }),
      }));
      toast.success("The account's credentials still work (demo)");
      return out;
    },
    verifying,
    disconnect: async (connectionId) => {
      await wait(400);
      set((s) => ({
        connections: s.connections.filter((c) => c.id !== connectionId),
        teams: s.teams.map((t) => (s.connections.find((c) => c.id === connectionId)?.teams.some((x) => x.team_id === t.team_id) ? { ...t, league_info: { ...t.league_info, has_espn_credentials: false, has_yahoo_credentials: false } } : t)),
      }));
      toast.success("Account disconnected; its teams stay (demo)");
    },
    usePrefs: useDemoPrefs,
    savePrefs: async (prefs) => {
      await wait(300);
      set({ prefs });
      toast.success("Alert settings saved (demo)");
    },
    useTeamPrefs: useDemoTeamPrefs,
    saveTeamPrefs: async (teamId, data) => {
      await wait(300);
      set((s) => ({ teamPrefs: s.teamPrefs.map((p) => (p.team_id === teamId ? { ...p, ...data, has_override: true } : p)) }));
      toast.success("Team alert settings saved (demo)");
    },
    clearTeamPrefs: async (teamId) => {
      await wait(300);
      set((s) => ({
        teamPrefs: s.teamPrefs.map((p) =>
          p.team_id === teamId
            ? { team_id: teamId, has_override: false, lineup_alerts_enabled: null, alert_benched_starters: null, alert_active_non_playing: null, alert_injured_active: null, alert_minutes_before: null, auto_lineup_enabled: null, email: null }
            : p
        ),
      }));
      toast.success("Back to the account's alert settings (demo)");
    },
    user: DEMO_USER,
    signOut: () => toast.info("Demo: nothing to sign out of"),
    openProfile: null,
  };
}
