import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteNotificationWorkspaceRule from "@/fetchers/notification-preferences/delete-notification-workspace-rule";
import updateNotificationPreferences, {
  type UpdateNotificationPreferencesRequest,
} from "@/fetchers/notification-preferences/update-notification-preferences";
import upsertNotificationWorkspaceRule, {
  type UpsertNotificationWorkspaceRuleRequest,
} from "@/fetchers/notification-preferences/upsert-notification-workspace-rule";

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (json: UpdateNotificationPreferencesRequest) =>
      updateNotificationPreferences(json),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["notification-preferences"],
      });
    },
  });
}

export function useUpsertNotificationWorkspaceRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      json,
    }: {
      workspaceId: string;
      json: UpsertNotificationWorkspaceRuleRequest;
    }) => upsertNotificationWorkspaceRule(workspaceId, json),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["notification-preferences"],
      });
    },
  });
}

export function useDeleteNotificationWorkspaceRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) =>
      deleteNotificationWorkspaceRule(workspaceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["notification-preferences"],
      });
    },
  });
}
