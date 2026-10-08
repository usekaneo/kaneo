import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { updateAdminWorkspaceMemberRole } from "@/fetchers/admin/update-admin-workspace-member-role";
import { toast } from "@/lib/toast";
import { syncAdminWorkspaceMembers } from "./sync-admin-workspace-members";

function useUpdateAdminWorkspaceMemberRole() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAdminWorkspaceMemberRole,
    onSuccess: (members, { workspaceId }) => {
      toast.success(t("settings:adminWorkspaces.toast.roleUpdated"));
      syncAdminWorkspaceMembers(queryClient, workspaceId, members);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminWorkspaces.toast.roleError"),
      );
    },
  });
}

export default useUpdateAdminWorkspaceMemberRole;
