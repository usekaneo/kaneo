import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";

type ArchiveTasksModalProps = {
  open: boolean;
  disabled?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  taskCount: number;
};

export function ArchiveTasksModal({
  open,
  disabled = false,
  onClose,
  onConfirm,
  taskCount,
}: ArchiveTasksModalProps) {
  const { t } = useTranslation();
  const [shownCount, setShownCount] = useState(taskCount);
  if (open && taskCount !== shownCount) setShownCount(taskCount);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t("tasks:archive.confirmTitle", { count: shownCount })}
      description={t("tasks:archive.confirmDescription")}
      confirmLabel={t("tasks:actions.archive")}
      destructive={false}
      confirmDisabled={disabled}
      onConfirm={onConfirm}
    />
  );
}
