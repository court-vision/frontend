export interface NotificationPreference {
  lineup_alerts_enabled: boolean;
  alert_benched_starters: boolean;
  alert_active_non_playing: boolean;
  alert_injured_active: boolean;
  alert_minutes_before: number;
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
  email: string | null;
}

export interface NotificationTeamPreferenceRequest {
  lineup_alerts_enabled: boolean | null;
  alert_benched_starters: boolean | null;
  alert_active_non_playing: boolean | null;
  alert_injured_active: boolean | null;
  alert_minutes_before: number | null;
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
