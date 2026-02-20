import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type {
  NotificationPreference,
  NotificationTeamPreferenceRequest,
} from "@/types/notifications";

export const notificationKeys = {
  all: ["notifications"] as const,
  preferences: () => [...notificationKeys.all, "preferences"] as const,
};

export function useNotificationPreferencesQuery() {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: () => apiClient.getNotificationPreferences(getToken),
    enabled: isSignedIn === true,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUpdateNotificationPreferencesMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: (data: NotificationPreference) =>
      apiClient.updateNotificationPreferences(getToken, data),
    onSuccess: () => {
      toast.success("Preferences saved.");
      queryClient.invalidateQueries({ queryKey: notificationKeys.preferences() });
    },
    onError: (error) => {
      console.error("Update notification preferences error:", error);
      toast.error("Failed to save preferences. Please try again.");
    },
  });
}

export function useTeamNotificationPreferencesQuery() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: [...notificationKeys.all, "team-preferences"] as const,
    queryFn: () => apiClient.getTeamNotificationPreferences(getToken),
    enabled: isSignedIn === true,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpsertTeamPreferenceMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: ({ teamId, data }: { teamId: number; data: NotificationTeamPreferenceRequest }) =>
      apiClient.upsertTeamNotificationPreference(getToken, teamId, data),
    onSuccess: () => {
      toast.success("Team preferences saved.");
      queryClient.invalidateQueries({ queryKey: [...notificationKeys.all, "team-preferences"] });
    },
    onError: () => {
      toast.error("Failed to save team preferences. Please try again.");
    },
  });
}

export function useDeleteTeamPreferenceMutation() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: (teamId: number) =>
      apiClient.deleteTeamNotificationPreference(getToken, teamId),
    onSuccess: () => {
      toast.success("Team override removed. Using global defaults.");
      queryClient.invalidateQueries({ queryKey: [...notificationKeys.all, "team-preferences"] });
    },
    onError: () => {
      toast.error("Failed to remove team override.");
    },
  });
}
