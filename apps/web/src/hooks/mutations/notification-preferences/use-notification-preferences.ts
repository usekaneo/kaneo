import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellOffIcon, BellIcon } from "lucide-react";
import i18n from "i18next";
import deleteNotificationWorkspaceRule from "@/fetchers/notification-preferences/delete-notification-workspace-rule";
import updateNotificationPreferences, {
  type UpdateNotificationPreferencesRequest,
} from "@/fetchers/notification-preferences/update-notification-preferences";
import upsertNotificationWorkspaceRule, {
  type UpsertNotificationWorkspaceRuleRequest,
} from "@/fetchers/notification-preferences/upsert-notification-workspace-rule";
import { toast } from "@/lib/toast";

export function useUpdateNotificationPreferences({
  silent = false,
}: { silent?: boolean } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (json: UpdateNotificationPreferencesRequest) =>
      updateNotificationPreferences(json),
    onSuccess: (preferences) => {
      queryClient.setQueryData(["notification-preferences"], preferences);
      void queryClient.invalidateQueries({
        queryKey: ["notification-preferences"],
      });
      if (!silent) {
        toast.success(
          i18n.t("settings:notificationsPage.toastPreferencesSaved"),
          { icon: BellIcon },
        );
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : i18n.t("settings:notificationsPage.toastPreferencesSaveFailed"),
      );
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
    onSuccess: (preferences) => {
      queryClient.setQueryData(["notification-preferences"], preferences);
      void queryClient.invalidateQueries({
        queryKey: ["notification-preferences"],
      });
      toast.success(
        i18n.t("settings:notificationsPage.toastRuleSavedGeneric"),
        { icon: BellIcon },
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : i18n.t("settings:notificationsPage.toastRuleSaveFailed", {}),
      );
    },
  });
}

export function useDeleteNotificationWorkspaceRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) =>
      deleteNotificationWorkspaceRule(workspaceId),
    onSuccess: (preferences) => {
      queryClient.setQueryData(["notification-preferences"], preferences);
      void queryClient.invalidateQueries({
        queryKey: ["notification-preferences"],
      });
      toast.success(
        i18n.t("settings:notificationsPage.toastRuleRemovedGeneric"),
        { icon: BellOffIcon },
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : i18n.t("settings:notificationsPage.toastRuleRemoveFailed", {}),
      );
    },
  });
}
