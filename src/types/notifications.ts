/** The Late scratches row below AI: off, notify (an email with the swap a ruling calls for) or act (Court Vision makes it). */
export type LateScratchLevel = "off" | "notify" | "act";

export interface NotificationPreference {
  lineup_alerts_enabled: boolean;
  /** Legacy alert-type flags: the pipeline no longer reads them, but the API still carries them. */
  alert_benched_starters: boolean;
  alert_active_non_playing: boolean;
  alert_injured_active: boolean;
  alert_minutes_before: number;
  /** Let Court Vision apply the fill-only plan to ESPN before tip-off (runs in the alerts pass, so it needs alerts on). */
  auto_lineup_enabled: boolean;
  /** Late scratches below AI (an API that predates it leaves it out: off). */
  late_scratch_level?: LateScratchLevel;
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
  late_scratch_level?: LateScratchLevel | null;
  email: string | null;
}

/**
 * A write to a team's own settings: a field left out keeps what the team
 * holds, and null hands it back to the account's.
 */
export interface NotificationTeamPreferenceRequest {
  lineup_alerts_enabled?: boolean | null;
  alert_benched_starters?: boolean | null;
  alert_active_non_playing?: boolean | null;
  alert_injured_active?: boolean | null;
  alert_minutes_before?: number | null;
  auto_lineup_enabled?: boolean | null;
  late_scratch_level?: LateScratchLevel | null;
  email?: string | null;
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
