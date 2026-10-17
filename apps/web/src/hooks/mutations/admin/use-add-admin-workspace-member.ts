import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { addAdminWorkspaceMember } from "@/fetchers/admin/add-admin-workspace-member";
import { toast } from "@/lib/toast";
import { syncAdminWorkspaceMembers } from "./sync-admin-workspace-members";

function useAddAdminWorkspaceMember() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addAdminWorkspaceMember,
    onSuccess: (members, { workspaceId }) => {
      toast.success(t("settings:adminWorkspaces.toast.added"), {
        icon: UserPlusIcon,
      });
      syncAdminWorkspaceMembers(queryClient, workspaceId, members);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminWorkspaces.toast.addError"),
      );
    },
  });
}

export default useAddAdminWorkspaceMember;
