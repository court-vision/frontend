import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";
import { toApiError, userMessage } from "@/lib/api-error";
import { streamTurn, type AiTurnDone } from "@/lib/ai-stream";
import type { AiConversation, AiConversationSummary, AiFeedback, AiTable, AiUsage } from "@/types/ai";

/**
 * The words for an AI desk error. The backend writes its AI_* refusals for the
 * user ("You've used this month's assistant budget; it resets on the 1st"),
 * which the generic copy for their status ("Too many requests") would hide.
 */
export function aiMessage(error: unknown, fallback?: string): string {
  const err = toApiError(error);
  if (err.code?.startsWith("AI_") && err.message) return err.message;
  return userMessage(err, fallback);
}

export const aiKeys = {
  all: ["ai"] as const,
  usage: () => [...aiKeys.all, "usage"] as const,
  conversations: () => [...aiKeys.all, "conversations"] as const,
  conversation: (id: number) => [...aiKeys.all, "conversation", id] as const,
};

/** Whether the caller may use the agent, and this month's spend. 503 = turned off. */
export function useAiUsageQuery() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<AiUsage>({
    queryKey: aiKeys.usage(),
    queryFn: ({ signal }) => apiClient.getAiUsage(getToken, { signal }),
    enabled: isSignedIn === true,
    staleTime: 60_000,
    retry: false,
    meta: { toast: false },
  });
}

export function useAiConversationsQuery(enabled: boolean) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<AiConversationSummary[]>({
    queryKey: aiKeys.conversations(),
    queryFn: ({ signal }) => apiClient.listAiConversations(getToken, { signal }),
    enabled: enabled && isSignedIn === true,
    staleTime: 30_000,
    meta: { toast: false },
  });
}

export function useAiConversationQuery(id: number | null, enabled: boolean) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<AiConversation>({
    queryKey: aiKeys.conversation(id!),
    queryFn: ({ signal }) => apiClient.getAiConversation(getToken, id!, { signal }),
    enabled: enabled && id != null && isSignedIn === true,
    staleTime: 30_000,
    meta: { toast: false },
  });
}

export function useCreateAiConversation() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (teamId: number | null) => apiClient.createAiConversation(getToken, teamId),
    onSuccess: (conversation) => {
      queryClient.setQueryData(aiKeys.conversation(conversation.id), conversation);
      void queryClient.invalidateQueries({ queryKey: aiKeys.conversations() });
    },
  });
}

export function useDeleteAiConversation() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.deleteAiConversation(getToken, id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: aiKeys.conversation(id) });
      void queryClient.invalidateQueries({ queryKey: aiKeys.conversations() });
    },
  });
}

/** 👍 / 👎 on an answer, shown at once and put back if the save fails. */
export function useAiFeedback(conversationId: number | null) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ turnId, feedback }: { turnId: number; feedback: AiFeedback | null }) =>
      apiClient.sendAiFeedback(getToken, turnId, feedback),
    onMutate: ({ turnId, feedback }) => {
      if (conversationId == null) return undefined;
      const key = aiKeys.conversation(conversationId);
      const before = queryClient.getQueryData<AiConversation>(key);
      if (before) {
        queryClient.setQueryData<AiConversation>(key, {
          ...before,
          history: before.history.map((t) => (t.id === turnId ? { ...t, feedback } : t)),
        });
      }
      return before;
    },
    onError: (_err, _vars, before) => {
      if (conversationId != null && before) queryClient.setQueryData(aiKeys.conversation(conversationId), before);
    },
  });
}

// ---- the live turn

export type LivePart = { kind: "text"; text: string } | { kind: "block"; block: AiTable };

export interface LiveTurn {
  conversationId: number;
  message: string;
  parts: LivePart[];
  /** What the agent is doing right now; null once it is writing or finished. */
  status: string | null;
  phase: "sending" | "streaming" | "done" | "failed";
  error: { code: string; message: string } | null;
  done: AiTurnDone | null;
}

/**
 * One turn at a time, streamed into state as it arrives. When it ends, the
 * conversation, the list and the month's spend are read again; the page shows
 * the stored turn in place of the live one once the conversation has it.
 */
export function useAiTurn() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [live, setLive] = useState<LiveTurn | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const send = useCallback(
    async (conversationId: number, message: string): Promise<boolean> => {
      const controller = new AbortController();
      abort.current = controller;
      setLive({ conversationId, message, parts: [], status: "Thinking", phase: "sending", error: null, done: null });
      const update = (fn: (t: LiveTurn) => LiveTurn) => setLive((t) => (t && t.conversationId === conversationId ? fn(t) : t));
      try {
        await streamTurn(
          getToken,
          apiClient.aiTurnUrl(conversationId),
          message,
          (e) => {
            switch (e.event) {
              case "status":
                update((t) => ({ ...t, phase: "streaming", status: e.data.text }));
                break;
              case "text":
                update((t) => {
                  const parts = [...t.parts];
                  const last = parts[parts.length - 1];
                  if (last?.kind === "text") parts[parts.length - 1] = { kind: "text", text: last.text + e.data.delta };
                  else parts.push({ kind: "text", text: e.data.delta });
                  return { ...t, phase: "streaming", status: null, parts };
                });
                break;
              case "block":
                update((t) => ({ ...t, phase: "streaming", parts: [...t.parts, { kind: "block", block: e.data }] }));
                break;
              case "error":
                update((t) => ({ ...t, error: e.data }));
                break;
              case "done":
                update((t) => ({ ...t, status: null, done: e.data, phase: t.error || e.data.outcome !== "ok" ? "failed" : "done" }));
                break;
            }
          },
          controller.signal
        );
        return true;
      } catch (err) {
        if (controller.signal.aborted) return false;
        const apiError = toApiError(err);
        update((t) => ({
          ...t,
          status: null,
          phase: "failed",
          error: { code: apiError.code ?? "ERROR", message: aiMessage(apiError) },
        }));
        // Refused before it started (busy, budget, invite): nothing was stored
        return false;
      } finally {
        if (abort.current === controller) abort.current = null;
        void queryClient.invalidateQueries({ queryKey: aiKeys.conversation(conversationId) });
        void queryClient.invalidateQueries({ queryKey: aiKeys.conversations() });
        void queryClient.invalidateQueries({ queryKey: aiKeys.usage() });
      }
    },
    [getToken, queryClient]
  );

  const clear = useCallback(() => setLive(null), []);
  const running = live != null && (live.phase === "sending" || live.phase === "streaming");
  return { live, running, send, clear };
}
