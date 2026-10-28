import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";

type BulkDeleteConfirmProps = {
  open: boolean;
  count: number;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function BulkDeleteConfirm({
  open,
  count,
  pending,
  onOpenChange,
  onConfirm,
}: BulkDeleteConfirmProps) {
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("tasks:bulk.deleteConfirmTitle", { count })}
      description={t("tasks:bulk.deleteConfirmDescription")}
      confirmLabel={t("common:actions.delete")}
      pendingLabel={t("common:actions.deleting")}
      pending={pending}
      onConfirm={onConfirm}
    />
  );
}
