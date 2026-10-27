import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import useArchiveAdminWorkspace from "@/hooks/mutations/admin/use-archive-admin-workspace";
import useRestoreAdminWorkspace from "@/hooks/mutations/admin/use-restore-admin-workspace";
import type { PendingWorkspaceAction } from "./pending-workspace-action";

type WorkspaceLifecycleConfirmDialogProps = {
  action: PendingWorkspaceAction | null;
  onClose: () => void;
};

/** Confirms archiving or restoring a workspace. */
export function WorkspaceLifecycleConfirmDialog({
  action,
  onClose,
}: WorkspaceLifecycleConfirmDialogProps) {
  const { t } = useTranslation();
  const [shownAction, setShownAction] = useState(action);
  const archive = useArchiveAdminWorkspace();
  const restore = useRestoreAdminWorkspace();
  const isPending = archive.isPending || restore.isPending;
  const isOpen = action !== null && action.type !== "delete";

  if (isOpen && action !== shownAction) {
    setShownAction(action);
  }

  const handleConfirm = async () => {
    if (!action) return;
    try {
      if (action.type === "archive") {
        await archive.mutateAsync(action.workspace.id);
      } else {
        await restore.mutateAsync(action.workspace.id);
      }
      onClose();
    } catch {
      return;
    }
  };

  const isRestore = shownAction?.type === "restore";
  const values = { name: shownAction?.workspace.name ?? "" };

  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
      title={t(
        isRestore
          ? "settings:adminWorkspaces.confirm.restore.title"
          : "settings:adminWorkspaces.confirm.archive.title",
        values,
      )}
      description={t(
        isRestore
          ? "settings:adminWorkspaces.confirm.restore.description"
          : "settings:adminWorkspaces.confirm.archive.description",
        values,
      )}
      confirmLabel={t(
        isRestore
          ? "settings:adminWorkspaces.confirm.restore.action"
          : "settings:adminWorkspaces.confirm.archive.action",
      )}
      pendingLabel={t("settings:adminWorkspaces.confirm.working")}
      pending={isPending}
      destructive={!isRestore}
      onConfirm={handleConfirm}
    />
  );
}
