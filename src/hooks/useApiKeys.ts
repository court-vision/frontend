import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { CreateApiKeyRequest } from "@/types/api-keys";

export const apiKeysKeys = {
  all: ["api-keys"] as const,
  list: () => [...apiKeysKeys.all, "list"] as const,
};

export function useApiKeysQuery() {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: apiKeysKeys.list(),
    queryFn: () => apiClient.listApiKeys(getToken),
    enabled: isSignedIn === true,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateApiKeyMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: (body: CreateApiKeyRequest) =>
      apiClient.createApiKey(getToken, body),
    onSuccess: () => {
      toast.success("API key created successfully!");
      queryClient.invalidateQueries({ queryKey: apiKeysKeys.list() });
    },
    onError: (error) => {
      console.error("Create API key error:", error);
      toast.error("Failed to create API key. Please try again.");
    },
  });
}

export function useRevokeApiKeyMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: (keyId: string) => apiClient.revokeApiKey(getToken, keyId),
    onSuccess: () => {
      toast.success("API key revoked.");
      queryClient.invalidateQueries({ queryKey: apiKeysKeys.list() });
    },
    onError: (error) => {
      console.error("Revoke API key error:", error);
      toast.error("Failed to revoke API key. Please try again.");
    },
  });
}
