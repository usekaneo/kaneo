import { Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ApiKeyItem } from "@/components/settings/api-keys/api-key-item";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import useDeleteApiKey from "@/hooks/mutations/api-key/use-delete-api-key";
import { toast } from "@/lib/toast";

type DeleteApiKeyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiKey: ApiKeyItem | null;
};

export function DeleteApiKeyDialog({
  open,
  onOpenChange,
  apiKey,
}: DeleteApiKeyDialogProps) {
  const { t } = useTranslation();
  const { mutateAsync: deleteApiKey, isPending } = useDeleteApiKey();
  const name = apiKey?.name || t("settings:developerPage.unnamedKey");

  const handleConfirm = async () => {
    if (!apiKey) return;

    try {
      await deleteApiKey(apiKey.id);
      toast.success(t("settings:apiKey.table.toastDeleted"), {
        icon: Trash2Icon,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:apiKey.table.toastDeleteError"),
      );
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next || !isPending) onOpenChange(next);
      }}
      title={t("settings:apiKey.table.deleteConfirmTitle", { name })}
      description={t("settings:apiKey.table.deleteConfirmDescription", {
        name,
      })}
      confirmLabel={t("settings:apiKey.table.delete")}
      pendingLabel={t("settings:apiKey.table.deleting")}
      pending={isPending}
      onConfirm={handleConfirm}
    />
  );
}
