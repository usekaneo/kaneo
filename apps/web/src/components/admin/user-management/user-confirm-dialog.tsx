import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import useDeleteAdminUser from "@/hooks/mutations/admin/use-delete-admin-user";
import useToggleAdminUserStatus from "@/hooks/mutations/admin/use-toggle-admin-user-status";
import type { PendingUserAction } from "./pending-user-action";

type UserConfirmDialogProps = {
  action: PendingUserAction | null;
  onClose: () => void;
};

export function UserConfirmDialog({ action, onClose }: UserConfirmDialogProps) {
  const { t } = useTranslation();
  const [shownAction, setShownAction] = useState(action);
  const { mutateAsync: toggleUserStatus, isPending: isToggling } =
    useToggleAdminUserStatus();
  const { mutateAsync: deleteUser, isPending: isDeleting } =
    useDeleteAdminUser();
  const isPending = isToggling || isDeleting;

  if (action && action !== shownAction) {
    setShownAction(action);
  }

  const handleConfirm = async () => {
    if (!action) return;

    try {
      if (action.type === "delete") {
        await deleteUser(action.user.id);
      } else {
        await toggleUserStatus({
          userId: action.user.id,
          deactivate: action.type === "deactivate",
        });
      }
      onClose();
    } catch {
      return;
    }
  };

  const type = shownAction?.type ?? "delete";
  const values = { name: shownAction?.user.name ?? "" };
  const copy =
    type === "deactivate"
      ? {
          title: t("settings:adminUsers.confirm.deactivate.title"),
          description: t(
            "settings:adminUsers.confirm.deactivate.description",
            values,
          ),
          action: t("settings:adminUsers.confirm.deactivate.action"),
        }
      : type === "reactivate"
        ? {
            title: t("settings:adminUsers.confirm.reactivate.title"),
            description: t(
              "settings:adminUsers.confirm.reactivate.description",
              values,
            ),
            action: t("settings:adminUsers.confirm.reactivate.action"),
          }
        : {
            title: t("settings:adminUsers.confirm.delete.title"),
            description: t(
              "settings:adminUsers.confirm.delete.description",
              values,
            ),
            action: t("settings:adminUsers.confirm.delete.action"),
          };

  return (
    <ConfirmDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.action}
      pendingLabel={t("settings:adminUsers.confirm.working")}
      pending={isPending}
      destructive={type !== "reactivate"}
      onConfirm={handleConfirm}
    />
  );
}
