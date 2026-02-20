"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  useTeamNotificationPreferencesQuery,
  useUpsertTeamPreferenceMutation,
  useDeleteTeamPreferenceMutation,
} from "@/hooks/useNotificationPreferences";
import { useTeamsQuery } from "@/hooks/useTeams";
import { LineupAlertForm } from "./LineupAlertForm";
import type { NotificationPreference } from "@/types/notifications";
import type { NotificationTeamPreference } from "@/types/notifications";
import type { NotificationTeamPreferenceRequest } from "@/types/notifications";

const DEFAULT_PREFS: NotificationPreference = {
  lineup_alerts_enabled: false,
  alert_benched_starters: true,
  alert_active_non_playing: true,
  alert_injured_active: true,
  alert_minutes_before: 90,
  email: null,
};

function GlobalForm({
  globalPrefs,
  clerkEmail,
  onMutate,
  isPending,
}: {
  globalPrefs: NotificationPreference;
  clerkEmail: string;
  onMutate: (prefs: NotificationPreference, opts: { onSuccess: () => void }) => void;
  isPending: boolean;
}) {
  const [prefs, setPrefs] = useState<NotificationPreference>(globalPrefs);
  const [isDirty, setIsDirty] = useState(false);

  function handleChange(newPrefs: NotificationPreference) {
    setPrefs(newPrefs);
    setIsDirty(true);
  }

  function handleSave() {
    onMutate(prefs, { onSuccess: () => setIsDirty(false) });
  }

  return (
    <LineupAlertForm
      prefs={prefs}
      onChange={handleChange}
      onSave={handleSave}
      isDirty={isDirty}
      isSaving={isPending}
      clerkEmail={clerkEmail}
    />
  );
}

function TeamForm({
  teamId,
  globalPrefs,
  teamOverride,
  clerkEmail,
  onUpsert,
  onDelete,
  isUpserting,
  isDeleting,
}: {
  teamId: number;
  globalPrefs: NotificationPreference;
  teamOverride: NotificationTeamPreference | undefined;
  clerkEmail: string;
  onUpsert: (
    params: { teamId: number; data: NotificationTeamPreferenceRequest },
    opts: { onSuccess: () => void }
  ) => void;
  onDelete: (teamId: number) => void;
  isUpserting: boolean;
  isDeleting: boolean;
}) {
  const hasOverride = !!teamOverride?.has_override;

  // Local "editing" flag: when user clicks "Customize" but hasn't saved yet
  const [isEditing, setIsEditing] = useState(false);

  const initialPrefs: NotificationPreference = hasOverride && teamOverride
    ? {
        lineup_alerts_enabled: teamOverride.lineup_alerts_enabled ?? globalPrefs.lineup_alerts_enabled,
        alert_benched_starters: teamOverride.alert_benched_starters ?? globalPrefs.alert_benched_starters,
        alert_active_non_playing: teamOverride.alert_active_non_playing ?? globalPrefs.alert_active_non_playing,
        alert_injured_active: teamOverride.alert_injured_active ?? globalPrefs.alert_injured_active,
        alert_minutes_before: teamOverride.alert_minutes_before ?? globalPrefs.alert_minutes_before,
        email: teamOverride.email ?? globalPrefs.email,
      }
    : { ...globalPrefs };

  const [prefs, setPrefs] = useState<NotificationPreference>(initialPrefs);
  const [isDirty, setIsDirty] = useState(false);

  // Sync when override data changes from server
  useEffect(() => {
    if (hasOverride && teamOverride) {
      setPrefs({
        lineup_alerts_enabled: teamOverride.lineup_alerts_enabled ?? globalPrefs.lineup_alerts_enabled,
        alert_benched_starters: teamOverride.alert_benched_starters ?? globalPrefs.alert_benched_starters,
        alert_active_non_playing: teamOverride.alert_active_non_playing ?? globalPrefs.alert_active_non_playing,
        alert_injured_active: teamOverride.alert_injured_active ?? globalPrefs.alert_injured_active,
        alert_minutes_before: teamOverride.alert_minutes_before ?? globalPrefs.alert_minutes_before,
        email: teamOverride.email ?? globalPrefs.email,
      });
      setIsDirty(false);
    }
  }, [teamOverride, hasOverride, globalPrefs]);

  function handleChange(newPrefs: NotificationPreference) {
    setPrefs(newPrefs);
    setIsDirty(true);
  }

  function handleSave() {
    const data: NotificationTeamPreferenceRequest = {
      lineup_alerts_enabled: prefs.lineup_alerts_enabled,
      alert_benched_starters: prefs.alert_benched_starters,
      alert_active_non_playing: prefs.alert_active_non_playing,
      alert_injured_active: prefs.alert_injured_active,
      alert_minutes_before: prefs.alert_minutes_before,
      email: prefs.email,
    };
    onUpsert({ teamId, data }, { onSuccess: () => { setIsDirty(false); setIsEditing(false); } });
  }

  function handleCreateOverride() {
    setIsEditing(true);
  }

  function handleResetToGlobal() {
    onDelete(teamId);
    setIsEditing(false);
  }

  return (
    <LineupAlertForm
      prefs={prefs}
      onChange={handleChange}
      onSave={handleSave}
      isDirty={isDirty}
      isSaving={isUpserting || isDeleting}
      clerkEmail={clerkEmail}
      isTeamOverride
      hasExistingOverride={hasOverride || isEditing}
      globalPrefs={globalPrefs}
      onCreateOverride={handleCreateOverride}
      onResetToGlobal={handleResetToGlobal}
    />
  );
}

export function NotificationSettings() {
  const { user } = useUser();
  const clerkEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  const [activeTab, setActiveTab] = useState<"global" | string>("global");

  const { data: globalPrefs, isLoading: prefsLoading } = useNotificationPreferencesQuery();
  const { data: teams = [], isLoading: teamsLoading } = useTeamsQuery();
  const { data: teamOverrides = [], isLoading: overridesLoading } = useTeamNotificationPreferencesQuery();

  const updateGlobalMutation = useUpdateNotificationPreferencesMutation();
  const upsertTeamMutation = useUpsertTeamPreferenceMutation();
  const deleteTeamMutation = useDeleteTeamPreferenceMutation();

  const isLoading = prefsLoading || teamsLoading || overridesLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-md" />
        <Skeleton className="h-40 w-full rounded-md" />
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
    );
  }

  const resolvedGlobal = globalPrefs ?? DEFAULT_PREFS;

  return (
    <div className="space-y-3">
      {/* Tab strip */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("global")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
            activeTab === "global"
              ? "bg-primary/10 text-primary border border-primary/20"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Global
        </button>
        {teams.map((team) => {
          const teamIdStr = String(team.team_id);
          const teamName = team.league_info.team_name;
          const hasOverride = teamOverrides.some(
            (o) => o.team_id === team.team_id && o.has_override
          );
          const displayName =
            teamName.length > 20
              ? teamName.slice(0, 20) + "..."
              : teamName;
          return (
            <button
              key={team.team_id}
              onClick={() => setActiveTab(teamIdStr)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                activeTab === teamIdStr
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {displayName}
              {hasOverride && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Form */}
      {activeTab === "global" ? (
        <GlobalForm
          key="global"
          globalPrefs={resolvedGlobal}
          clerkEmail={clerkEmail}
          onMutate={(prefs, opts) => updateGlobalMutation.mutate(prefs, opts)}
          isPending={updateGlobalMutation.isPending}
        />
      ) : (
        <TeamForm
          key={activeTab}
          teamId={Number(activeTab)}
          globalPrefs={resolvedGlobal}
          teamOverride={teamOverrides.find((o) => o.team_id === Number(activeTab))}
          clerkEmail={clerkEmail}
          onUpsert={(params, opts) => upsertTeamMutation.mutate(params, opts)}
          onDelete={(teamId) => deleteTeamMutation.mutate(teamId)}
          isUpserting={upsertTeamMutation.isPending}
          isDeleting={deleteTeamMutation.isPending}
        />
      )}
    </div>
  );
}
