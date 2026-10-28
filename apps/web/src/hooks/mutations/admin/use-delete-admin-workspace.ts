import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { deleteAdminWorkspace } from "@/fetchers/admin/delete-admin-workspace";
import { toast } from "@/lib/toast";
import { refreshAfterWorkspaceLifecycle } from "./refresh-after-workspace-lifecycle";

function useDeleteAdminWorkspace() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAdminWorkspace,
    onSuccess: () => {
      toast.success(t("settings:adminWorkspaces.toast.deleted"), {
        icon: Trash2Icon,
      });
      refreshAfterWorkspaceLifecycle(queryClient);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminWorkspaces.toast.deleteError"),
      );
    },
  });
}

export default useDeleteAdminWorkspace;
