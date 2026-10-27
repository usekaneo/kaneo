import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import useDeleteAdminUser from "@/hooks/mutations/admin/use-delete-admin-user";
import useMarkAdminUserEmailVerified from "@/hooks/mutations/admin/use-mark-admin-user-email-verified";
import useSendAdminUserPasswordReset from "@/hooks/mutations/admin/use-send-admin-user-password-reset";
import useSendAdminUserVerificationEmail from "@/hooks/mutations/admin/use-send-admin-user-verification-email";
import useToggleAdminUserStatus from "@/hooks/mutations/admin/use-toggle-admin-user-status";
import type { PendingUserAction } from "./pending-user-action";
import { USER_ACTION_COPY } from "./user-action-copy";

type UserConfirmDialogProps = {
  action: PendingUserAction | null;
  onClose: () => void;
};

export function UserConfirmDialog({ action, onClose }: UserConfirmDialogProps) {
  const { t } = useTranslation();
  const [shownAction, setShownAction] = useState(action);
  const toggleStatus = useToggleAdminUserStatus();
  const deleteUser = useDeleteAdminUser();
  const sendPasswordReset = useSendAdminUserPasswordReset();
  const sendVerification = useSendAdminUserVerificationEmail();
  const markEmailVerified = useMarkAdminUserEmailVerified();
  const isPending = [
    toggleStatus,
    deleteUser,
    sendPasswordReset,
    sendVerification,
    markEmailVerified,
  ].some((mutation) => mutation.isPending);

  if (action && action !== shownAction) {
    setShownAction(action);
  }

  const run = ({ type, user }: PendingUserAction) => {
    switch (type) {
      case "delete":
        return deleteUser.mutateAsync(user.id);
      case "deactivate":
      case "reactivate":
        return toggleStatus.mutateAsync({
          userId: user.id,
          deactivate: type === "deactivate",
        });
      case "sendPasswordReset":
        return sendPasswordReset.mutateAsync(user);
      case "sendVerification":
        return sendVerification.mutateAsync(user);
      case "markEmailVerified":
        return markEmailVerified.mutateAsync(user);
    }
  };

  const handleConfirm = async () => {
    if (!action) return;
    try {
      await run(action);
      onClose();
    } catch {
      return;
    }
  };

  const copy = USER_ACTION_COPY[shownAction?.type ?? "delete"];
  const values = {
    name: shownAction?.user.name ?? "",
    email: shownAction?.user.email ?? "",
  };

  return (
    <ConfirmDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
      title={t(copy.title)}
      description={copy.description ? t(copy.description, values) : undefined}
      confirmLabel={t(copy.action)}
      pendingLabel={t("settings:adminUsers.confirm.working")}
      pending={isPending}
      destructive={copy.destructive}
      onConfirm={handleConfirm}
    />
  );
}
