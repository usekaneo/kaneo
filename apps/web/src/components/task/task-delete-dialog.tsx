import type { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { shortcuts } from "@/constants/shortcuts";
import { useDeleteTask } from "@/hooks/mutations/task/use-delete-task";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

type TaskDeleteDialogProps = {
  handle: AlertDialogPrimitive.Handle<unknown>;
  taskId: string;
  onDeleted: () => void;
  shortcutEnabled?: boolean;
};

export default function TaskDeleteDialog({
  handle,
  taskId,
  onDeleted,
  shortcutEnabled = true,
}: TaskDeleteDialogProps) {
  const { t } = useTranslation();
  const { canDeleteTasks, isCheckingPermissions } = useWorkspacePermission();
  const { mutateAsync: deleteTask, isPending } = useDeleteTask();
  const canDelete = !isCheckingPermissions && canDeleteTasks();

  const deleteShortcuts = useMemo(
    () =>
      canDelete && shortcutEnabled
        ? {
            modifierShortcuts: {
              [shortcuts.deleteTask.prefix]: {
                [shortcuts.deleteTask.key]: () => handle.open(null),
              },
            },
          }
        : {},
    [canDelete, shortcutEnabled, handle],
  );
  useRegisterShortcuts(deleteShortcuts);

  useEffect(() => {
    return () => handle.close();
  }, [handle, taskId]);

  if (!canDelete) {
    return null;
  }

  const handleDelete = async () => {
    try {
      await deleteTask(taskId);
      toast.success(t("tasks:delete.success"));
      handle.close();
      onDeleted();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:delete.error"),
      );
    }
  };

  return (
    <AlertDialog handle={handle}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("tasks:delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("tasks:delete.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            render={<Button variant="outline" size="sm" disabled={isPending} />}
          >
            {t("common:actions.cancel")}
          </AlertDialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={() => void handleDelete()}
          >
            {isPending
              ? t("common:actions.deleting")
              : t("tasks:delete.action")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
