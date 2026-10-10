import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { transferAdminWorkspaceOwnership } from "@/fetchers/admin/transfer-admin-workspace-ownership";
import { toast } from "@/lib/toast";
import { syncAdminWorkspaceMembers } from "./sync-admin-workspace-members";

function useTransferAdminWorkspaceOwnership() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: transferAdminWorkspaceOwnership,
    onSuccess: (members, { workspaceId }) => {
      toast.success(t("settings:adminWorkspaces.toast.ownershipTransferred"));
      syncAdminWorkspaceMembers(queryClient, workspaceId, members);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminWorkspaces.toast.transferError"),
      );
    },
  });
}

export default useTransferAdminWorkspaceOwnership;
