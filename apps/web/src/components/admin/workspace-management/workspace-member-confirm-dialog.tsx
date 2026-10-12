import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import type { PendingMemberAction } from "./pending-member-action";

type Props = {
  action: PendingMemberAction | null;
  workspaceName: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function WorkspaceMemberConfirmDialog({
  action,
  workspaceName,
  isPending,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const [shownAction, setShownAction] = useState(action);

  if (action && action !== shownAction) {
    setShownAction(action);
  }

  const isTransfer = shownAction?.type === "transfer";
  const values = {
    name: shownAction
      ? shownAction.member.name || shownAction.member.email
      : "",
    workspace: workspaceName,
  };
  const copy = isTransfer
    ? {
        title: t("settings:adminWorkspaces.confirm.transfer.title", values),
        description: t(
          "settings:adminWorkspaces.confirm.transfer.description",
          values,
        ),
        action: t("settings:adminWorkspaces.confirm.transfer.action"),
      }
    : {
        title: t("settings:adminWorkspaces.confirm.remove.title", values),
        description: t(
          "settings:adminWorkspaces.confirm.remove.description",
          values,
        ),
        action: t("settings:adminWorkspaces.confirm.remove.action"),
      };

  return (
    <ConfirmDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onCancel();
      }}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.action}
      pendingLabel={t("settings:adminWorkspaces.confirm.working")}
      pending={isPending}
      destructive={!isTransfer}
      onConfirm={onConfirm}
    />
  );
}

export default WorkspaceMemberConfirmDialog;
