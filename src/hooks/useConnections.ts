import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { teamsKeys } from "@/hooks/useTeams";
import type { EspnConnectRequest } from "@/types/connections";

export const connectionKeys = {
  all: ["connections"] as const,
  list: () => [...connectionKeys.all, "list"] as const,
  espnTeams: (connectionId: number) => [...connectionKeys.all, "espn-teams", connectionId] as const,
};

/** The user's provider connections (ESPN accounts, Yahoo), without credentials. */
export function useConnectionsQuery() {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: connectionKeys.list(),
    queryFn: () => apiClient.getConnections(getToken),
    enabled: isSignedIn === true,
    staleTime: 1000 * 60 * 5,
  });
}

/** The teams on a connected ESPN account, as ESPN lists them. */
export function useEspnAccountTeamsQuery(connectionId: number | null) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: connectionKeys.espnTeams(connectionId ?? 0),
    queryFn: () => apiClient.getEspnAccountTeams(getToken, connectionId!),
    enabled: connectionId !== null && isSignedIn === true,
    staleTime: 1000 * 60 * 2,
    // The picker renders its own error state
    meta: { toast: false },
  });
}

/**
 * Connect an ESPN account, or refresh the cookies of one already connected.
 * ESPN's refusal is shown in the form, so it is not also toasted.
 */
export function useConnectEspnMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: (body: EspnConnectRequest) => apiClient.connectEspn(getToken, body),
    meta: { toast: false },
    onSuccess: (response) => {
      // Saved but unconfirmed (only public leagues to check against) is not a success to celebrate
      if (response.data?.status === "ok") toast.success(response.message);
      else toast.info(response.message);
      queryClient.invalidateQueries({ queryKey: connectionKeys.all });
      // Every team on the account reads ESPN with the new cookies
      queryClient.invalidateQueries({ queryKey: teamsKeys.all });
    },
  });
}

/** Ask ESPN whether a stored connection's cookies still work. */
export function useVerifyConnectionMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: (connectionId: number) => apiClient.verifyConnection(getToken, connectionId),
    onSuccess: (response) => {
      const status = response.data?.status;
      if (status === "ok") toast.success(response.message);
      else if (status === "expired") toast.error(response.message);
      else toast.info(response.message);
      queryClient.invalidateQueries({ queryKey: connectionKeys.list() });
    },
  });
}

/** Remove a connection. Its teams are unlinked, not deleted. */
export function useDeleteConnectionMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: (connectionId: number) => apiClient.deleteConnection(getToken, connectionId),
    onSuccess: (response) => {
      toast.success(response.message || "Connection removed");
      queryClient.invalidateQueries({ queryKey: connectionKeys.all });
      queryClient.invalidateQueries({ queryKey: teamsKeys.lists() });
    },
  });
}
