import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
  const values = {
    name: action ? action.member.name || action.member.email : "",
    workspace: workspaceName,
  };
  const copy =
    action?.type === "transfer"
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
    <AlertDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onCancel();
      }}
    >
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            render={<Button type="button" variant="ghost" />}
            disabled={isPending}
          >
            {t("common:actions.cancel")}
          </AlertDialogClose>
          <Button
            type="button"
            variant={action?.type === "transfer" ? "default" : "destructive"}
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending
              ? t("settings:adminWorkspaces.confirm.working")
              : copy.action}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}

export default WorkspaceMemberConfirmDialog;
