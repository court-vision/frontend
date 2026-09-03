"use client";

import { useMemo } from "react";
import { Check, Pencil, Undo2, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  capStatuses,
  fillLineup,
  keeperStatuses,
  myRoster,
  openStartingSlots,
  teamStacks,
  type KeeperStatus,
  type RosterPlayer,
} from "@/lib/draft-roster";
import type { DraftBoardResult, DraftPick, DraftSession } from "@/types/draft";

/**
 * The room's right rail: the caller's roster laid into the league's lineup
 * slots, the caps and stacks it is running into, the keepers still to record,
 * and where the draft is.
 *
 * Everything here is derived — the board's `roster` entries carry position
 * and team, the session's picks carry order and who took whom — so the zone
 * never disagrees with the board it sits beside.
 */
interface RosterZoneProps {
  session: DraftSession | null;
  board: DraftBoardResult | null;
  onUndo?: (overallPick: number) => void;
  onUndoLast?: () => void;
  isUndoing?: boolean;
  onEditKeepers?: () => void;
  onRecordKeepers?: (pending: KeeperStatus[]) => void;
  isRecordingKeepers?: boolean;
}

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="shrink-0 border-y border-border/50 bg-muted/30 px-2 py-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
        {right !== undefined && (
          <span className="ml-auto flex items-center gap-1.5 font-mono normal-case tracking-normal">
            {right}
          </span>
        )}
      </div>
    </div>
  );
}

function UndoButton({
  overallPick,
  onUndo,
  isUndoing,
}: {
  overallPick: number;
  onUndo?: (overallPick: number) => void;
  isUndoing?: boolean;
}) {
  if (!onUndo) return null;
  return (
    <Button
      size="icon"
      variant="ghost"
      disabled={isUndoing}
      onClick={() => onUndo(overallPick)}
      title={`Undo pick ${overallPick}`}
      className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
    >
      <Undo2 className="h-3 w-3" />
    </Button>
  );
}

function LineupRow({
  slot,
  player,
  onUndo,
  isUndoing,
}: {
  slot: string;
  player: RosterPlayer | null;
  onUndo?: (overallPick: number) => void;
  isUndoing?: boolean;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 border-b border-border/20 px-2 py-1 font-mono text-[10px]",
        player ? "bg-primary/5" : "text-muted-foreground/50"
      )}
    >
      <span className="w-9 shrink-0 text-muted-foreground/70">{slot}</span>
      {player ? (
        <>
          <span className="truncate text-primary">{player.name}</span>
          {player.keeper && (
            <span
              title="Keeper"
              className="shrink-0 rounded border border-primary/40 px-1 text-[8px] uppercase text-primary"
            >
              K
            </span>
          )}
          <span className="ml-auto shrink-0 text-muted-foreground/60">
            {[player.primary_position, player.team].filter(Boolean).join(" · ")}
          </span>
          {player.overall_pick !== null && (
            <UndoButton overallPick={player.overall_pick} onUndo={onUndo} isUndoing={isUndoing} />
          )}
        </>
      ) : (
        <span>—</span>
      )}
    </div>
  );
}

function PickRow({
  pick,
  onUndo,
  isUndoing,
}: {
  pick: DraftPick;
  onUndo?: (overallPick: number) => void;
  isUndoing?: boolean;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 border-b border-border/20 px-2 py-1 font-mono text-[10px]",
        pick.by_me && "bg-primary/5"
      )}
    >
      <span className="w-6 shrink-0 text-right text-muted-foreground/70">{pick.overall_pick}</span>
      <span className={cn("truncate", pick.by_me ? "text-primary" : "text-foreground")}>
        {pick.player_name ?? `Player ${pick.player_id ?? "?"}`}
      </span>
      {pick.source === "keeper" && (
        <span
          title="Keeper — spent before the draft"
          className="shrink-0 rounded border border-primary/40 px-1 text-[8px] uppercase text-primary"
        >
          K
        </span>
      )}
      {pick.round !== null && pick.round !== undefined && (
        <span className="ml-auto shrink-0 text-muted-foreground/50">R{pick.round}</span>
      )}
      <UndoButton overallPick={pick.overall_pick} onUndo={onUndo} isUndoing={isUndoing} />
    </div>
  );
}

export function RosterZone({
  session,
  board,
  onUndo,
  onUndoLast,
  isUndoing = false,
  onEditKeepers,
  onRecordKeepers,
  isRecordingKeepers = false,
}: RosterZoneProps) {
  const picks = useMemo(() => session?.picks ?? [], [session]);
  const roster = useMemo(() => myRoster(board?.roster ?? [], picks), [board, picks]);
  const rosterSlots = useMemo(() => board?.meta?.roster_slots ?? {}, [board]);
  const positionLimits = useMemo(() => board?.meta?.position_limits ?? {}, [board]);
  const hasSlots = Object.keys(rosterSlots).length > 0;

  const lineup = useMemo(() => fillLineup(rosterSlots, roster), [rosterSlots, roster]);
  const open = useMemo(() => openStartingSlots(lineup), [lineup]);
  const caps = useMemo(() => capStatuses(roster, positionLimits), [roster, positionLimits]);
  const stacks = useMemo(() => teamStacks(roster), [roster]);
  const keepers = useMemo(() => keeperStatuses(session?.keepers ?? [], picks), [session, picks]);
  const pendingKeepers = keepers.filter((k) => !k.recorded && k.blocker === null);
  const recent = useMemo(
    () => [...picks].sort((a, b) => b.overall_pick - a.overall_pick).slice(0, 12),
    [picks]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/50 bg-muted/30 px-2 py-2">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <Users className="h-3 w-3" />
          My roster
          <span className="ml-auto font-mono normal-case tracking-normal">
            {roster.length}
            {session?.rounds ? ` / ${session.rounds}` : ""}
          </span>
          {onUndoLast && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isUndoing || picks.length === 0}
              onClick={onUndoLast}
              title="Undo the last pick (⌘Z)"
              className="h-5 gap-1 px-1.5 text-[10px] normal-case tracking-normal"
            >
              <Undo2 className="h-3 w-3" />
              Undo
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Lineup: the league's slots, filled */}
        {hasSlots ? (
          <>
            {lineup.slots.map((entry, index) => (
              <LineupRow
                key={`${entry.slot}-${index}`}
                slot={entry.slot}
                player={entry.player}
                onUndo={onUndo}
                isUndoing={isUndoing}
              />
            ))}
            {lineup.overflow.map((player) => (
              <LineupRow
                key={`overflow-${player.player_id}`}
                slot="—"
                player={player}
                onUndo={onUndo}
                isUndoing={isUndoing}
              />
            ))}
          </>
        ) : roster.length === 0 ? (
          <p className="px-2 py-3 text-[10px] text-muted-foreground">
            Nothing drafted yet. Type a name in the pick input and press{" "}
            <span className="font-mono">⇧↵</span>, or press <span className="font-mono">m</span> on
            a highlighted row.
          </p>
        ) : (
          roster.map((player) => (
            <LineupRow
              key={player.player_id}
              slot={player.primary_position ?? "—"}
              player={player}
              onUndo={onUndo}
              isUndoing={isUndoing}
            />
          ))
        )}

        {/* Caps, open slots, stacks */}
        {(caps.length > 0 || open.length > 0 || stacks.length > 0) && (
          <div className="space-y-1 border-b border-border/30 px-2 py-1.5 font-mono text-[10px]">
            {caps.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-muted-foreground/60">caps</span>
                {caps.map((cap) => (
                  <span
                    key={cap.position}
                    title={`${cap.position}: ${cap.count} of a hard cap of ${cap.limit}`}
                    className={cn(
                      "rounded border px-1",
                      cap.count > cap.limit
                        ? "border-red-500/40 bg-red-500/10 text-red-500"
                        : cap.count === cap.limit
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                          : "border-border/50 text-muted-foreground"
                    )}
                  >
                    {cap.position} {cap.count}/{cap.limit}
                  </span>
                ))}
              </div>
            )}
            {open.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
                <span className="text-muted-foreground/60">open</span>
                {open.map((o) => (
                  <span key={o.slot}>
                    {o.open} {o.slot}
                  </span>
                ))}
              </div>
            )}
            {stacks.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-muted-foreground/60">stacks</span>
                {stacks.map((stack) => (
                  <span
                    key={stack.team}
                    title={`${stack.count} of your players share ${stack.team}'s schedule`}
                    className={cn(
                      "rounded border px-1",
                      stack.count >= 3
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                        : "border-border/50 text-muted-foreground"
                    )}
                  >
                    {stack.team} ×{stack.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Keepers */}
        {(onEditKeepers || keepers.length > 0) && (
          <>
            <SectionHeader
              title="Keepers"
              right={
                <>
                  <span>
                    {keepers.length}
                    {session?.keeper_count != null ? ` / ${session.keeper_count}` : ""}
                  </span>
                  {onEditKeepers && (
                    <button
                      onClick={onEditKeepers}
                      title="Edit keepers"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </>
              }
            />
            {keepers.length === 0 ? (
              <p className="px-2 py-2 text-[10px] text-muted-foreground">
                No keepers designated.
              </p>
            ) : (
              keepers.map(({ keeper, recorded, blocker }, index) => (
                <div
                  key={`${keeper.player_id ?? keeper.name ?? index}`}
                  className="flex items-center gap-2 border-b border-border/20 px-2 py-1 font-mono text-[10px]"
                >
                  {recorded ? (
                    <Check className="h-3 w-3 shrink-0 text-green-500" />
                  ) : (
                    <span className="h-3 w-3 shrink-0 rounded-full border border-border" />
                  )}
                  <span className={cn("truncate", recorded ? "text-primary" : "text-foreground")}>
                    {keeper.name ?? `Player ${keeper.player_id ?? "?"}`}
                  </span>
                  <span className="ml-auto shrink-0 text-muted-foreground/60">
                    {keeper.round != null ? `R${keeper.round}` : "no round"}
                    {keeper.overall_pick != null ? ` · pick ${keeper.overall_pick}` : ""}
                  </span>
                  {!recorded && blocker && (
                    <span className="shrink-0 text-amber-500">{blocker}</span>
                  )}
                </div>
              ))
            )}
            {pendingKeepers.length > 0 && onRecordKeepers && (
              <div className="px-2 py-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isRecordingKeepers}
                  onClick={() => onRecordKeepers(pendingKeepers)}
                  className="h-6 w-full text-[10px]"
                  title="Records each keeper at the pick its round costs; they leave the board and never count as the draft front"
                >
                  {isRecordingKeepers
                    ? "Recording..."
                    : `Record ${pendingKeepers.length} keeper${pendingKeepers.length === 1 ? "" : "s"}`}
                </Button>
              </div>
            )}
          </>
        )}

        {/* Recent picks */}
        <SectionHeader
          title="Recent picks"
          right={
            <span>
              {session?.pick_count ?? 0}
              {session?.total_picks ? ` / ${session.total_picks}` : ""}
            </span>
          }
        />
        {recent.length === 0 ? (
          <p className="px-2 py-3 text-[10px] text-muted-foreground">The draft has not started.</p>
        ) : (
          recent.map((pick) => (
            <PickRow key={pick.overall_pick} pick={pick} onUndo={onUndo} isUndoing={isUndoing} />
          ))
        )}
      </div>
    </div>
  );
}
