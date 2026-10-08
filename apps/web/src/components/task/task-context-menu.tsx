import { type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import TaskCardContextMenuContent from "@/components/kanban-board/task-card-context-menu/task-card-context-menu-content";
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
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useDeleteTask } from "@/hooks/mutations/task/use-delete-task";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskContextMenuProps = {
  task: Task;
  projectId: string;
  children: ReactElement;
};

export default function TaskContextMenu({
  task,
  projectId,
  children,
}: TaskContextMenuProps) {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const { mutateAsync: deleteTask } = useDeleteTask();
  // The menu content pulls in several queries, so it mounts on first open.
  const [hasOpenedMenu, setHasOpenedMenu] = useState(false);
  // Null until first opened, then kept mounted so the dialog can animate out.
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean | null>(null);

  const handleDelete = async () => {
    try {
      await deleteTask(task.id);
      toast.success(t("tasks:delete.success"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:delete.error"),
      );
    }
  };

  return (
    <>
      <ContextMenu
        onOpenChange={(open) => {
          if (open) setHasOpenedMenu(true);
        }}
      >
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        {hasOpenedMenu && workspace && (
          <TaskCardContextMenuContent
            task={task}
            taskCardContext={{
              projectId,
              worskpaceId: workspace.id,
              workspaceSlug: workspace.slug,
            }}
            onDeleteClick={() => setIsDeleteOpen(true)}
          />
        )}
      </ContextMenu>

      {isDeleteOpen !== null && (
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("tasks:delete.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("tasks:delete.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant="outline" size="sm" />}>
                {t("common:actions.cancel")}
              </AlertDialogClose>
              <AlertDialogClose
                render={
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleDelete()}
                  />
                }
              >
                {t("tasks:delete.action")}
              </AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
