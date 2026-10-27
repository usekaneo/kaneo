import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import useDeleteAdminWorkspace from "@/hooks/mutations/admin/use-delete-admin-workspace";
import { matchesWorkspaceName } from "./matches-workspace-name";
import type { PendingWorkspaceAction } from "./pending-workspace-action";

type DeleteWorkspaceDialogProps = {
  action: PendingWorkspaceAction | null;
  onClose: () => void;
};

/** Deletes a workspace once the administrator types its name. */
export function DeleteWorkspaceDialog({
  action,
  onClose,
}: DeleteWorkspaceDialogProps) {
  const { t } = useTranslation();
  const [shownAction, setShownAction] = useState(action);
  const [typed, setTyped] = useState("");
  const { mutateAsync: deleteWorkspace, isPending } = useDeleteAdminWorkspace();
  const isOpen = action?.type === "delete";

  if (isOpen && action !== shownAction) {
    setShownAction(action);
    setTyped("");
  }

  const workspace = shownAction?.workspace;
  const name = workspace?.name ?? "";
  const confirmed = matchesWorkspaceName(typed, name);

  const handleConfirm = async () => {
    if (!workspace || !confirmed || isPending) return;
    try {
      await deleteWorkspace(workspace.id);
      onClose();
    } catch {
      return;
    }
  };

  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
      title={t("settings:adminWorkspaces.confirm.delete.title", { name })}
      description={t("settings:adminWorkspaces.confirm.delete.description")}
      confirmLabel={t("settings:adminWorkspaces.confirm.delete.action")}
      pendingLabel={t("common:actions.deleting")}
      pending={isPending}
      confirmDisabled={!confirmed}
      onConfirm={handleConfirm}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleConfirm();
        }}
      >
        <Field>
          <FieldLabel htmlFor="admin-delete-workspace-name">
            {t("settings:adminWorkspaces.confirm.delete.typeName", { name })}
          </FieldLabel>
          <Input
            type="text"
            id="admin-delete-workspace-name"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            disabled={isPending}
            onChange={(event) => setTyped(event.target.value)}
          />
        </Field>
      </form>
    </ConfirmDialog>
  );
}
