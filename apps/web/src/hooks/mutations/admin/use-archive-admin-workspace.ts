import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArchiveIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { archiveAdminWorkspace } from "@/fetchers/admin/archive-admin-workspace";
import { toast } from "@/lib/toast";
import { refreshAfterWorkspaceLifecycle } from "./refresh-after-workspace-lifecycle";

function useArchiveAdminWorkspace() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveAdminWorkspace,
    onSuccess: () => {
      toast.success(t("settings:adminWorkspaces.toast.archived"), {
        icon: ArchiveIcon,
      });
      refreshAfterWorkspaceLifecycle(queryClient);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminWorkspaces.toast.archiveError"),
      );
    },
  });
}

export default useArchiveAdminWorkspace;
