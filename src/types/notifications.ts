export interface NotificationPreference {
  lineup_alerts_enabled: boolean;
  /** Legacy alert-type flags: the pipeline no longer reads them, but the API still carries them. */
  alert_benched_starters: boolean;
  alert_active_non_playing: boolean;
  alert_injured_active: boolean;
  alert_minutes_before: number;
  /** Let Court Vision apply the fill-only plan to ESPN before tip-off (requires alerts on). */
  auto_lineup_enabled: boolean;
  email: string | null;
}

export interface NotificationPreferenceResponse {
  status: string;
  message: string;
  data: NotificationPreference;
}

export interface NotificationTeamPreference {
  team_id: number;
  has_override: boolean;
  lineup_alerts_enabled: boolean | null;
  alert_benched_starters: boolean | null;
  alert_active_non_playing: boolean | null;
  alert_injured_active: boolean | null;
  alert_minutes_before: number | null;
  auto_lineup_enabled: boolean | null;
  email: string | null;
}

export interface NotificationTeamPreferenceRequest {
  lineup_alerts_enabled: boolean | null;
  alert_benched_starters: boolean | null;
  alert_active_non_playing: boolean | null;
  alert_injured_active: boolean | null;
  alert_minutes_before: number | null;
  auto_lineup_enabled: boolean | null;
  email: string | null;
}

export interface NotificationTeamPreferenceListResponse {
  status: string;
  message: string;
  data: NotificationTeamPreference[];
}

export interface NotificationTeamPreferenceSingleResponse {
  status: string;
  message: string;
  data: NotificationTeamPreference;
}
