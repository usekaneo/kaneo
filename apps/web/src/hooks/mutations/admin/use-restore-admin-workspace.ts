import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestoreIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { restoreAdminWorkspace } from "@/fetchers/admin/restore-admin-workspace";
import { toast } from "@/lib/toast";
import { refreshAfterWorkspaceLifecycle } from "./refresh-after-workspace-lifecycle";

function useRestoreAdminWorkspace() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreAdminWorkspace,
    onSuccess: () => {
      toast.success(t("settings:adminWorkspaces.toast.restored"), {
        icon: ArchiveRestoreIcon,
      });
      refreshAfterWorkspaceLifecycle(queryClient);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminWorkspaces.toast.restoreError"),
      );
    },
  });
}

export default useRestoreAdminWorkspace;
