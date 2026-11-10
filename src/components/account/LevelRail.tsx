"use client";

import { toast } from "sonner";
import { SegRail } from "@/components/desk/SegRail";
import { LEVEL_HELP, LEVEL_LABEL } from "@/lib/ai-autonomy";
import type { AiLevel, AiLevelOption } from "@/types/ai";
import dk from "@/components/desk/desk.module.css";

/**
 * An automation's levels as a segmented rail: Off, Notify, Act (and AI on a team
 * Dime runs on). A level the row can't do stays in the rail, dimmed, and says why
 * when it is hovered or tapped; the level in force is the checked one.
 */
export function LevelRail({
  label,
  options,
  value,
  labels,
  disabled,
  onPick,
}: {
  label: string;
  options: AiLevelOption[];
  value: AiLevel;
  /** A segment's own words (the Check-ins row's Pause and Resume). */
  labels?: Partial<Record<AiLevel, string>>;
  disabled?: boolean;
  onPick: (level: AiLevel) => void;
}) {
  return (
    <SegRail label={label} active={value}>
      {options.map((o) => {
        const on = o.level === value;
        // The level in force stays readable even if the row could no longer pick it
        const unavailable = !o.available && !on;
        return (
          <button
            key={o.level}
            type="button"
            role="radio"
            aria-checked={on}
            aria-disabled={unavailable || undefined}
            className={`${dk.seg} ${on ? dk.segOn : ""}`}
            style={unavailable ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
            disabled={disabled && !unavailable}
            title={o.reason ?? LEVEL_HELP[o.level]}
            onClick={() => {
              if (on) return;
              if (unavailable) {
                if (o.reason) toast.info(o.reason);
                return;
              }
              onPick(o.level);
            }}
          >
            <span className={dk.segLabel}>{labels?.[o.level] ?? LEVEL_LABEL[o.level]}</span>
          </button>
        );
      })}
    </SegRail>
  );
}
