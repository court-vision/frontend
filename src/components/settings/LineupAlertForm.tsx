"use client";

import { Bell, Mail, Clock, ShieldAlert, Armchair, CalendarX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import type { NotificationPreference } from "@/types/notifications";

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-3 transition-opacity duration-200",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 h-7 w-7 shrink-0 rounded-md bg-muted flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-none">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="shrink-0"
      />
    </div>
  );
}

interface LineupAlertFormProps {
  prefs: NotificationPreference;
  onChange: (prefs: NotificationPreference) => void;
  onSave: () => void;
  isDirty: boolean;
  isSaving: boolean;
  clerkEmail: string;
  isTeamOverride?: boolean;
  hasExistingOverride?: boolean;
  globalPrefs?: NotificationPreference;
  onCreateOverride?: () => void;
  onResetToGlobal?: () => void;
}

export function LineupAlertForm({
  prefs,
  onChange,
  onSave,
  isDirty,
  isSaving,
  clerkEmail,
  isTeamOverride = false,
  hasExistingOverride = false,
  globalPrefs,
  onCreateOverride,
  onResetToGlobal,
}: LineupAlertFormProps) {
  const showDisabledOverlay = isTeamOverride && !hasExistingOverride;
  const displayPrefs = showDisabledOverlay && globalPrefs ? globalPrefs : prefs;

  function update<K extends keyof NotificationPreference>(
    key: K,
    value: NotificationPreference[K]
  ) {
    onChange({ ...prefs, [key]: value });
  }

  const subDisabled = showDisabledOverlay || !displayPrefs.lineup_alerts_enabled;

  return (
    <div className="space-y-3">
      {/* Team override banner */}
      {isTeamOverride && !hasExistingOverride && (
        <div className="bg-muted/50 border border-border rounded-md px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Using global defaults</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onCreateOverride}
          >
            Customize for this team &rarr;
          </Button>
        </div>
      )}

      {/* Master feature card */}
      <div
        className={cn(
          "rounded-md border transition-all duration-300",
          displayPrefs.lineup_alerts_enabled
            ? "bg-card/80 border-primary/25 shadow-[0_0_12px_hsl(var(--primary)/0.08)]"
            : "bg-card/80 border-border",
          showDisabledOverlay && "opacity-50 pointer-events-none"
        )}
      >
        {/* Header row */}
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-8 w-8 rounded-md flex items-center justify-center transition-colors duration-200",
                displayPrefs.lineup_alerts_enabled
                  ? "bg-primary/15 border border-primary/20"
                  : "bg-muted border border-transparent"
              )}
            >
              <Bell
                className={cn(
                  "h-4 w-4 transition-colors duration-200",
                  displayPrefs.lineup_alerts_enabled ? "text-primary" : "text-muted-foreground"
                )}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Lineup Alerts</span>
                <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider border border-border rounded px-1 py-0.5">
                  ESPN
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Email reminders before your players&apos; games tip off
              </p>
            </div>
          </div>
          <Switch
            checked={displayPrefs.lineup_alerts_enabled}
            onCheckedChange={(v) => update("lineup_alerts_enabled", v)}
          />
        </div>

        <Separator />

        {/* Sub-options */}
        <div
          className={cn(
            "px-4 pb-1 transition-opacity duration-200",
            subDisabled && "opacity-40 pointer-events-none"
          )}
        >
          <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest pt-3 pb-1">
            Alert Types
          </p>
          <ToggleRow
            icon={Armchair}
            label="Benched Starters"
            description="A player on your bench has a game today"
            checked={displayPrefs.alert_benched_starters}
            onCheckedChange={(v) => update("alert_benched_starters", v)}
            disabled={subDisabled}
          />
          <Separator className="opacity-50" />
          <ToggleRow
            icon={CalendarX}
            label="Active Players Not Playing"
            description="A player in your active lineup has no game today"
            checked={displayPrefs.alert_active_non_playing}
            onCheckedChange={(v) => update("alert_active_non_playing", v)}
            disabled={subDisabled}
          />
          <Separator className="opacity-50" />
          <ToggleRow
            icon={ShieldAlert}
            label="Injured Players Active"
            description="An injured player is sitting in an active roster slot"
            checked={displayPrefs.alert_injured_active}
            onCheckedChange={(v) => update("alert_injured_active", v)}
            disabled={subDisabled}
          />
        </div>
      </div>

      {/* Timing card */}
      <div
        className={cn(
          "rounded-md border bg-card/80 border-border px-4 py-3.5 transition-opacity duration-200",
          (subDisabled || showDisabledOverlay) && "opacity-40 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium leading-none">Notification Timing</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              How early to send the alert
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 flex flex-col gap-1">
            <div className="relative">
              <Slider
                min={0}
                max={150}
                step={15}
                value={[Math.min(150, Math.max(15, displayPrefs.alert_minutes_before))]}
                onValueChange={([v]) => update("alert_minutes_before", Math.max(15, v))}
                disabled={subDisabled || showDisabledOverlay}
              />
              {/* Gray out the 0–15 dead zone (first 10% of the 0–150 range) */}
              <div className="absolute top-0 left-0 bottom-0 flex items-center pointer-events-none" style={{ width: "10%" }}>
                <div className="h-1.5 w-full rounded-l-full bg-muted" />
              </div>
            </div>
            <div className="flex justify-between text-[9px] font-mono pl-2">
              <span className="text-muted-foreground/25">0</span>
              <span className="text-muted-foreground/40">30</span>
              <span className="text-muted-foreground/40">60</span>
              <span className="text-muted-foreground/40">90</span>
              <span className="text-muted-foreground/40">120</span>
              <span className="text-muted-foreground/40">150</span>
            </div>
          </div>
          <span className="text-sm font-mono font-medium w-16 text-right tabular-nums">
            {Math.min(150, Math.max(15, displayPrefs.alert_minutes_before))} min
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-1">
          minutes before first tip-off · 15 min intervals
        </p>
      </div>

      {/* Email card */}
      <div
        className={cn(
          "rounded-md border bg-card/80 border-border px-4 py-3.5",
          showDisabledOverlay && "opacity-40 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium leading-none">Notification Email</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Override the email address for alerts
            </p>
          </div>
        </div>
        <Input
          type="email"
          placeholder={clerkEmail || "your@email.com"}
          value={displayPrefs.email ?? ""}
          onChange={(e) => update("email", e.target.value || null)}
          className="h-8 text-sm"
        />
        <p className="text-[10px] text-muted-foreground/50 mt-2">
          Leave blank to use your account email
          {clerkEmail && (
            <span className="font-mono ml-1 text-muted-foreground/40">
              ({clerkEmail})
            </span>
          )}
        </p>
      </div>

      {/* Save footer */}
      {!(isTeamOverride && !hasExistingOverride) && (
        <div className="flex items-center justify-between pt-1 pb-2">
          <div className="flex items-center gap-2">
            {isTeamOverride && hasExistingOverride && onResetToGlobal && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={onResetToGlobal}
              >
                Reset to global defaults
              </Button>
            )}
            {!isTeamOverride && (
              isDirty ? (
                <p className="text-[11px] text-muted-foreground/60">Unsaved changes</p>
              ) : (
                <p className="text-[11px] text-muted-foreground/40">All changes saved</p>
              )
            )}
            {isTeamOverride && (
              isDirty ? (
                <p className="text-[11px] text-muted-foreground/60">Unsaved changes</p>
              ) : (
                <p className="text-[11px] text-muted-foreground/40">All changes saved</p>
              )
            )}
          </div>
          <Button
            size="sm"
            onClick={onSave}
            disabled={!isDirty || isSaving}
            className={cn(
              "h-8 text-xs gap-1.5 transition-all",
              isDirty && "shadow-[0_0_8px_hsl(var(--primary)/0.3)]"
            )}
          >
            {isSaving ? (
              <>
                <span className="h-3 w-3 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
