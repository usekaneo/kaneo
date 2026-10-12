import { Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import type { WorkspaceLabel } from "@/components/settings/labels/workspace-label";
import useDeleteLabel from "@/hooks/mutations/label/use-delete-label";
import { toast } from "@/lib/toast";

type DeleteLabelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: WorkspaceLabel | null;
};

export function DeleteLabelDialog({
  open,
  onOpenChange,
  label,
}: DeleteLabelDialogProps) {
  const { t } = useTranslation();
  const deleteLabel = useDeleteLabel();
  const resuming = Boolean(label?.deletionStartedAt);

  const handleConfirm = async () => {
    if (!label) return;

    try {
      await deleteLabel.mutateAsync({ id: label.id });
      toast.success(t("settings:workspaceLabels.deleteSuccess"), {
        icon: Trash2Icon,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceLabels.deleteError"),
      );
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next || !deleteLabel.isPending) onOpenChange(next);
      }}
      title={t("settings:workspaceLabels.deleteConfirmTitle", {
        name: label?.name ?? "",
      })}
      description={t("settings:workspaceLabels.deleteConfirmDescription")}
      confirmLabel={t(
        resuming
          ? "settings:workspaceLabels.resumeDeletion"
          : "settings:workspaceLabels.deleteLabel",
      )}
      pendingLabel={t("common:actions.deleting")}
      pending={deleteLabel.isPending}
      onConfirm={handleConfirm}
    />
  );
}
