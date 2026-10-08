import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { removeAdminWorkspaceMember } from "@/fetchers/admin/remove-admin-workspace-member";
import { toast } from "@/lib/toast";
import { syncAdminWorkspaceMembers } from "./sync-admin-workspace-members";

function useRemoveAdminWorkspaceMember() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeAdminWorkspaceMember,
    onSuccess: (members, { workspaceId }) => {
      toast.success(t("settings:adminWorkspaces.toast.removed"));
      syncAdminWorkspaceMembers(queryClient, workspaceId, members);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminWorkspaces.toast.removeError"),
      );
    },
  });
}

export default useRemoveAdminWorkspaceMember;
