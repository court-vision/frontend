import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { aiKeys, aiMessage } from "@/hooks/useAi";
import { lineupKeys, useTeamLineupQuery } from "@/hooks/useLineupEditor";
import { useRosterTransactionMutation } from "@/hooks/useRosterTransaction";
import { useSchedulePickupMutation } from "@/hooks/useScheduledPickups";
import {
  chipState,
  dropChipOf,
  sendOrder,
  stageProblem,
  swapChipOf,
  trayDaysOf,
  withStaged,
  withoutStaged,
  type ChipPatch,
  type StagedChip,
} from "@/lib/ai-proposals";
import { apiClient } from "@/lib/api";
import { toApiError } from "@/lib/api-error";
import { staleLineup } from "@/lib/lineup-editor";
import type { TrayDay } from "@/components/week/Tray";
import type { AiConversation, AiProposalChip } from "@/types/ai";
import { writeBlockedCopy } from "@/types/lineup-editor";

/** A chip's state written into the cached conversation, so its stored turn shows it at once. */
function patchConversation(c: AiConversation | undefined, patches: ReadonlyMap<number, ChipPatch>): AiConversation | undefined {
  if (!c) return c;
  return {
    ...c,
    history: c.history.map((t) => ({
      ...t,
      parts: t.parts.map((p) => {
        if (p.kind !== "block" || p.block.type !== "proposal") return p;
        const patch = patches.get(p.block.proposal_id);
        return patch ? { ...p, block: { ...p.block, ...patch } } : p;
      }),
    })),
  };
}

export interface ChipTray {
  staged: StagedChip[];
  stagedIds: ReadonlySet<number>;
  /** What the desk knows about chips since their turns were stored (sent, dismissed here). */
  patches: ReadonlyMap<number, ChipPatch>;
  /** The tray's columns; empty when nothing is staged. */
  days: TrayDay[];
  /** Why nothing can be sent (the team's roster writes are blocked, or its board can't be read). */
  blocked: string | null;
  sendingDay: number | null;
  busy: boolean;
  stage: (chip: AiProposalChip) => void;
  unstage: (proposalId: number) => void;
  dismiss: (chip: AiProposalChip) => void;
  /** The Week desk's tray's callbacks: a column's add / drop, a lone drop, a day, everything. */
  cancelSwap: (day: number) => void;
  undrop: (playerId: number) => void;
  discardDay: (day: number) => void;
  discardAll: () => void;
  /** Send these days, in order; stops at the first refusal, which stays on its column. */
  sendDays: (days: number[]) => Promise<void>;
}

/**
 * The chips staged in this conversation and the sends behind the tray's slider.
 * Staging asks the server to check the chip again (`GET /ai/proposals/{id}`);
 * sending is the Week desk's own writes — the roster transaction for a move
 * today, pinned to the board as it stands, or the scheduled pickup for a later
 * day — with `proposal_id` on the request, so the server marks the chip sent.
 * A refusal stays on the chip's column for a retry; a stale board is read again.
 */
export function useChipTray(conversationId: number | null): ChipTray {
  const { getToken, userId } = useAuth();
  const queryClient = useQueryClient();
  const [staged, setStaged] = useState<StagedChip[]>([]);
  const [patches, setPatches] = useState<ReadonlyMap<number, ChipPatch>>(() => new Map());
  const [sendingDay, setSendingDay] = useState<number | null>(null);
  // Chips expire with the clock: the columns are read against it when staging starts and every
  // minute after, so a chip that expires in the tray holds its column back as the thread shows it
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!staged.length) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [staged.length]);

  // Another conversation: its own tray (the server's copy of the chips says what became of them)
  useEffect(() => {
    setStaged([]);
    setPatches(new Map());
  }, [conversationId]);

  const teamId = staged[0]?.chip.team_id ?? null;
  const board = useTeamLineupQuery(teamId, teamId != null ? "espn" : null);
  const boardRef = useRef(board.data);
  boardRef.current = board.data;
  const transaction = useRosterTransactionMutation(teamId ?? 0);
  const pickup = useSchedulePickupMutation(teamId ?? 0);

  const patch = useCallback(
    (proposalId: number, value: ChipPatch) => {
      setPatches((prev) => new Map(prev).set(proposalId, value));
      if (conversationId != null) {
        const key = aiKeys.conversation(userId, conversationId);
        queryClient.setQueryData<AiConversation>(key, (c) => patchConversation(c, new Map([[proposalId, value]])));
      }
    },
    [conversationId, queryClient, userId]
  );
  const reread = useCallback(() => {
    if (conversationId != null) void queryClient.invalidateQueries({ queryKey: aiKeys.conversation(userId, conversationId) });
  }, [conversationId, queryClient, userId]);

  const unstage = useCallback((proposalId: number) => setStaged((s) => withoutStaged(s, proposalId)), []);

  const stage = useCallback(
    (chip: AiProposalChip) => {
      const problem = stageProblem(chip, staged);
      if (problem) {
        toast.info(problem);
        return;
      }
      setStaged((s) => withStaged(s, chip));
      void (async () => {
        try {
          const check = await apiClient.getAiProposal(getToken, chip.proposal_id);
          if (check.chip.state !== chip.state || check.chip.sent_at !== chip.sent_at) {
            patch(chip.proposal_id, { state: check.chip.state, sent_at: check.chip.sent_at });
          }
          if (chipState(check.chip) !== "proposed") {
            unstage(chip.proposal_id);
            toast.info(check.problems[0] ?? "This chip can't be staged any more");
            return;
          }
          setStaged((s) =>
            s.map((x) => (x.chip.proposal_id === chip.proposal_id ? { ...x, chip: check.chip, problems: check.problems, checking: false } : x))
          );
        } catch (err) {
          const e = toApiError(err);
          if (e.status === 404) {
            unstage(chip.proposal_id);
            toast.error("This chip is gone");
            return;
          }
          setStaged((s) =>
            s.map((x) =>
              x.chip.proposal_id === chip.proposal_id
                ? { ...x, checking: false, problems: [aiMessage(err, "The move couldn't be checked; try staging it again")] }
                : x
            )
          );
        }
      })();
    },
    [staged, getToken, patch, unstage]
  );

  const dismiss = useCallback(
    (chip: AiProposalChip) => {
      unstage(chip.proposal_id);
      void apiClient
        .dismissAiProposal(getToken, chip.proposal_id)
        .then((c) => patch(chip.proposal_id, { state: c.state, sent_at: c.sent_at }))
        .catch((err) => {
          const e = toApiError(err);
          // Sent in the meantime (from another tab, or a send that answered late): the chip says so
          if (e.code === "AI_PROPOSAL_SENT") patch(chip.proposal_id, { state: "sent", sent_at: chip.sent_at ?? new Date().toISOString() });
          else toast.error(aiMessage(err, "Couldn't dismiss the chip"));
          reread();
        });
    },
    [getToken, patch, reread, unstage]
  );

  const cancelSwap = useCallback((day: number) => setStaged((s) => (swapChipOf(s, day) ? withoutStaged(s, swapChipOf(s, day)!.chip.proposal_id) : s)), []);
  const undrop = useCallback((playerId: number) => setStaged((s) => (dropChipOf(s, playerId) ? withoutStaged(s, dropChipOf(s, playerId)!.chip.proposal_id) : s)), []);
  const discardDay = useCallback((day: number) => setStaged((s) => s.filter((x) => x.chip.day !== day)), []);
  const discardAll = useCallback(() => setStaged([]), []);

  const transactAsync = transaction.mutateAsync;
  const scheduleAsync = pickup.mutateAsync;
  const sendDays = useCallback(
    async (days: number[]) => {
      if (teamId == null) return;
      const fail = (proposalId: number, message: string) =>
        setStaged((s) => s.map((x) => (x.chip.proposal_id === proposalId ? { ...x, error: message } : x)));
      try {
        // Today's writes go one after another, each pinned to the board the one before handed back:
        // the mutation writes that board into the cache, but a ref only catches up on a render
        let board = boardRef.current;
        for (const day of days) {
          setSendingDay(day);
          for (const item of sendOrder(staged, day)) {
            const c = item.chip;
            const id = c.proposal_id;
            try {
              if (c.kind === "scheduled") {
                if (!c.add) throw new Error("A drop on its own can't be scheduled");
                await scheduleAsync({
                  add_player_id: c.add.espn_id,
                  drop_player_id: c.drop?.espn_id ?? null,
                  scoring_period_id: c.scoring_period_id,
                  proposal_id: id,
                });
              } else {
                if (!board || board.scoring_period_id == null) {
                  fail(id, "Your roster couldn't be read; try again in a moment");
                  return;
                }
                const made = await transactAsync({
                  add_player_id: c.add?.espn_id ?? null,
                  drop_player_id: c.drop?.espn_id ?? null,
                  expected_scoring_period_id: board.scoring_period_id,
                  roster_version: board.roster_version,
                  proposal_id: id,
                });
                board = made.lineup;
                // The later days' lineups hold the roster too; the shared mutation only refreshes today's
                void queryClient.invalidateQueries({ queryKey: lineupKeys.days(teamId) });
              }
              patch(id, { state: "sent", sent_at: new Date().toISOString() });
              unstage(id);
            } catch (err) {
              const e = toApiError(err);
              const state = (e.data as { state?: string } | undefined)?.state;
              if (e.code === "AI_PROPOSAL_NOT_PENDING" && (state === "sent" || state === "dismissed" || state === "expired")) {
                // Sent, dismissed or expired since it was staged: the chip says so and leaves the tray
                patch(id, { state, sent_at: state === "sent" ? new Date().toISOString() : null });
                unstage(id);
                toast.info(e.message);
                return;
              }
              if (staleLineup(err)) {
                // The mutation swapped the fresh board in; the move is checked against it again
                fail(id, "Your roster changed on ESPN; the board was refreshed, send again");
                return;
              }
              fail(id, aiMessage(err, "The move was refused"));
              return;
            }
          }
        }
      } finally {
        setSendingDay(null);
        reread();
      }
    },
    [teamId, staged, scheduleAsync, transactAsync, queryClient, patch, unstage, reread]
  );

  const days = useMemo(() => trayDaysOf(staged, now), [staged, now]);
  const stagedIds = useMemo(() => new Set(staged.map((x) => x.chip.proposal_id)), [staged]);
  const b = board.data;
  const blocked =
    teamId == null
      ? null
      : board.isError
        ? "Your roster couldn't be read"
        : b === undefined
          ? "Reading your roster…"
          : b === null
            ? "This team has no ESPN board to write to"
            : b.can_write
              ? null
              : writeBlockedCopy(b.write_blocked_reason);

  return {
    staged,
    stagedIds,
    patches,
    days,
    blocked,
    sendingDay,
    busy: sendingDay != null,
    stage,
    unstage,
    dismiss,
    cancelSwap,
    undrop,
    discardDay,
    discardAll,
    sendDays,
  };
}
