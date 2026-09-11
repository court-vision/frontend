"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, CheckCircle2, ListChecks, Loader2, RotateCcw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HintPopover } from "@/components/ui/hint";
import { QueryErrorState } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerHeadshot } from "@/components/terminal/shared";
import { ApplyLineupDialog } from "@/components/lineup/ApplyLineupDialog";
import { LineupEditorProvider, useLineupEditor } from "@/components/lineup/LineupEditorProvider";
import { AddStreamerDialog } from "@/components/streamers-components/AddStreamerDialog";
import { useDailyActionsQuery } from "@/hooks/useDailyActions";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import { useTerminalStore } from "@/stores/useTerminalStore";
import { useUIStore } from "@/stores/useUIStore";
import {
  boardMismatch,
  isLineupAction,
  isRowStaged,
  movesOf,
  rowButton,
  sortActions,
  streamersHint,
  suggestedDropId,
  unstagedLineupActions,
} from "@/lib/daily-actions";
import { getInjuryBadge } from "@/lib/injury-badge";
import { formatNbaDate, formatTipTime, slotName } from "@/lib/lineup-editor";
import { cn } from "@/lib/utils";
import type { DailyAction, DailyActionsData } from "@/types/daily-actions";
import { writeBlockedCopy } from "@/types/lineup-editor";
import type { StreamerPlayer } from "@/types/streamer";

/**
 * Today's recommended roster actions for the selected team, one row each, and
 * a button per row that stages the action for approval: lineup rows (start,
 * IR) stage into the shared lineup editor and are sent together from the
 * footer's "Apply on ESPN" confirm; pickup rows open the add/drop dialog with
 * both players preselected. Nothing here writes on its own.
 */
export function DailyActionsPanel() {
  const focusedTeamId = useTerminalStore((s) => s.focusedTeamId);
  const selectedTeam = useUIStore((s) => s.selectedTeam);
  // focusedTeamId in the terminal, the selected team on the dashboard.
  const teamId = focusedTeamId ?? selectedTeam;
  const { team, provider, isLoading: teamsLoading } = useSelectedTeam(teamId);
  const query = useDailyActionsQuery(teamId, provider);

  if (teamId == null || (!team && !teamsLoading)) {
    return (
      <Centered icon={<ListChecks className="h-6 w-6 text-muted-foreground/50" />}>
        <p className="text-sm text-muted-foreground">No team selected</p>
        <p className="text-xs text-muted-foreground/70">Select a team to see today&apos;s actions</p>
      </Centered>
    );
  }
  if (!team && teamsLoading) return <PanelSkeleton />;
  if (provider !== "espn") return <ReadOnlyNote text={writeBlockedCopy("provider_not_supported")} />;
  if (query.isLoading || (!query.data && !query.error)) return <PanelSkeleton />;
  if (query.error && !query.data) {
    return (
      <QueryErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
        compact
        className="h-full"
      />
    );
  }
  const data = query.data!;
  if (!data.lineup) return <ReadOnlyNote text={writeBlockedCopy(data.write_blocked_reason)} />;

  // Mounted only once the board is in the cache (the hook seeded it), so the
  // provider stages against exactly the board these rows came from.
  return (
    <LineupEditorProvider teamId={teamId}>
      <Body data={data} teamId={teamId} refetch={() => void query.refetch()} isFetching={query.isFetching} />
    </LineupEditorProvider>
  );
}

// ── Body (inside the editor) ──────────────────────────────────────────────

interface PendingTransaction {
  pickup: StreamerPlayer | null;
  dropId: number | null | undefined;
}

function Body({
  data,
  teamId,
  refetch,
  isFetching,
}: {
  data: DailyActionsData;
  teamId: number;
  refetch: () => void;
  isFetching: boolean;
}) {
  const editor = useLineupEditor();
  const [pending, setPending] = useState<PendingTransaction | null>(null);
  const [txnOpen, setTxnOpen] = useState(false);

  const actions = sortActions(data.actions ?? []);
  const staged = editor?.staged ?? {};
  const mismatch = boardMismatch(data, editor?.state);
  const canWrite = !!editor?.canWrite && !mismatch;
  const blockedReason = editor?.blockedReason ?? data.write_blocked_reason ?? null;
  const moves = editor?.moves ?? [];
  const validation = editor?.validation ?? [];
  const applying = !!editor?.applying;
  const unstaged = unstagedLineupActions(actions, staged);
  const hasLineupRows = actions.some(isLineupAction);
  const hint = streamersHint(data);

  // The board moved on (a poll, a write elsewhere): refetch the rows once per board.
  const refetchedFor = useRef<string | null>(null);
  const boardVersion = editor?.state?.roster_version ?? null;
  useEffect(() => {
    if (!mismatch || !boardVersion || refetchedFor.current === boardVersion) return;
    refetchedFor.current = boardVersion;
    refetch();
  }, [mismatch, boardVersion, refetch]);

  const act = (a: DailyAction) => {
    const button = rowButton(a, { staged: isRowStaged(staged, a), canWrite, blockedReason });
    switch (button.intent) {
      case "stage":
        editor?.stageMoves(movesOf(a));
        return;
      case "unstage":
        editor?.unstageMoves(movesOf(a));
        return;
      case "transaction":
        setPending({ pickup: a.transaction!.pickup, dropId: a.transaction!.drop_player_id ?? null });
        setTxnOpen(true);
        return;
      case "drop":
        setPending({ pickup: null, dropId: suggestedDropId(actions) });
        setTxnOpen(true);
        return;
      default:
        return;
    }
  };

  const stageAll = () => editor?.stageMoves(unstaged.flatMap(movesOf));
  const canApply = canWrite && moves.length > 0 && validation.length === 0 && !applying;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className="truncate">{formatNbaDate(data.nba_date) || "Today"}</span>
        <span className="flex shrink-0 items-center gap-2">
          {mismatch && <span className="normal-case tracking-normal">Board changed — refreshing</span>}
          {!mismatch && hint && <span className="normal-case tracking-normal">{hint}</span>}
          {isFetching && <Loader2 className="h-3 w-3 animate-spin" aria-label="Refreshing" />}
          {moves.length > 0 && (
            <span className="font-mono tabular-nums normal-case tracking-normal">{moves.length} staged</span>
          )}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {actions.length === 0 ? (
          <Centered icon={<CheckCircle2 className="h-6 w-6 text-status-win/70" />}>
            <p className="text-sm text-muted-foreground">All set for today</p>
            <p className="text-xs text-muted-foreground/70">Nothing to start, move, or pick up right now</p>
          </Centered>
        ) : (
          <ul className="divide-y divide-border/50">
            {actions.map((a) => (
              <ActionRow
                key={a.id}
                action={a}
                staged={isRowStaged(staged, a)}
                canWrite={canWrite}
                blockedReason={blockedReason}
                busy={applying}
                onAct={() => act(a)}
              />
            ))}
          </ul>
        )}
      </div>

      {(hasLineupRows || moves.length > 0) && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-border/50 px-2 py-1.5">
          {validation.length > 0 && (
            <p className="w-full truncate text-[10px] text-status-loss" aria-live="polite">
              {validation[0].message}
            </p>
          )}
          {unstaged.length >= 2 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="touch-hit h-7 text-[11px]"
              onClick={stageAll}
              disabled={!canWrite || applying}
            >
              Stage all ({unstaged.length})
            </Button>
          )}
          {moves.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="touch-hit h-7 gap-1 text-[11px] text-muted-foreground"
              onClick={() => editor?.reset()}
              disabled={applying}
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="touch-hit ml-auto h-7 gap-1 text-[11px]"
            onClick={() => editor?.setConfirmOpen(true)}
            disabled={!canApply}
          >
            {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Apply on ESPN
            {moves.length > 0 && <span className="font-mono tabular-nums">({moves.length})</span>}
          </Button>
          {!canWrite && moves.length > 0 && (
            <p className="w-full text-[10px] text-muted-foreground">{writeBlockedCopy(blockedReason)}</p>
          )}
        </div>
      )}

      <ApplyLineupDialog />
      {pending && (
        <AddStreamerDialog
          player={pending.pickup}
          teamId={teamId}
          open={txnOpen}
          onOpenChange={setTxnOpen}
          defaultDropId={pending.dropId}
        />
      )}
    </div>
  );
}

// ── Rows ──────────────────────────────────────────────────────────────────

function ActionRow({
  action,
  staged,
  canWrite,
  blockedReason,
  busy,
  onAct,
}: {
  action: DailyAction;
  staged: boolean;
  canWrite: boolean;
  blockedReason: string | null;
  busy: boolean;
  onAct: () => void;
}) {
  const button = rowButton(action, { staged, canWrite, blockedReason });
  const p = action.player;
  const tip = formatTipTime(action.game_time_et);
  const control = (
    <Button
      type="button"
      size="sm"
      variant={button.intent === "unstage" ? "secondary" : button.intent === "stage" ? "outline" : "default"}
      className="touch-hit h-7 shrink-0 gap-1 px-2 text-[11px]"
      disabled={button.disabled || busy}
      onClick={onAct}
      aria-label={`${button.label}: ${action.title}`}
    >
      {button.intent === "unstage" && <Check className="h-3 w-3" />}
      {button.label}
    </Button>
  );

  return (
    <li className={cn("flex items-center gap-2 px-3 py-1.5", staged && "bg-primary/5")}>
      <PlayerHeadshot playerId={p.nba_player_id} name={p.name} size="xs" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <span className="truncate">{action.title}</span>
          {getInjuryBadge(p.injury_status)}
          {p.lineup_slot_id != null && (
            <Badge variant="outline" className="h-4 shrink-0 px-1 font-mono text-[9px]">
              {slotName(p.lineup_slot_id)}
            </Badge>
          )}
          {staged && <span className="sr-only">(staged)</span>}
        </div>
        {action.detail && <p className="truncate text-[10px] text-muted-foreground">{action.detail}</p>}
      </div>
      {tip && <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">{tip}</span>}
      {button.reason ? (
        <HintPopover content={button.reason}>
          <span className="inline-flex">{control}</span>
        </HintPopover>
      ) : (
        control
      )}
    </li>
  );
}

// ── Small states ──────────────────────────────────────────────────────────

function Centered({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center">
      {icon}
      {children}
    </div>
  );
}

function ReadOnlyNote({ text }: { text: string }) {
  return (
    <Centered icon={<ListChecks className="h-6 w-6 text-muted-foreground/50" />}>
      <p className="text-xs text-muted-foreground">{text}</p>
    </Centered>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3" aria-busy="true" aria-label="Loading today's actions">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
