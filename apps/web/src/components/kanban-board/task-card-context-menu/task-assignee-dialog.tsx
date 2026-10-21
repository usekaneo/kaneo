import { useTranslation } from "react-i18next";
import { AssigneeOptionsMenu } from "@/components/task/menus/assignee-options-menu";
import { getTaskAssigneeIds } from "@/lib/get-task-assignee-ids";
import { Dialog, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUpdateTaskAssignee } from "@/hooks/mutations/task/use-update-task-assignee";
import useGetProjectMembers from "@/hooks/queries/workspace-users/use-get-project-members";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskAssigneeDialogProps = {
  task: Task;
  workspaceId: string;
  onClose: () => void;
};

export function TaskAssigneeDialog({
  task,
  workspaceId,
  onClose,
}: TaskAssigneeDialogProps) {
  const { t } = useTranslation();
  const members = useGetProjectMembers({
    workspaceId,
    projectId: task.projectId,
  });
  const { mutateAsync, isPending } = useUpdateTaskAssignee();
  const select = async (userId: string) => {
    if (isPending || members.isPending || members.isError) return;
    try {
      await mutateAsync({
        ...task,
        userId,
        assigneeMode: userId
          ? getTaskAssigneeIds(task).includes(userId)
            ? "remove"
            : "add"
          : "set",
        assigneeIds: [],
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.assignee.updateError"),
      );
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPopup className="max-w-xs overflow-hidden" showCloseButton={false}>
        <DialogTitle className="sr-only">
          {t("tasks:assignee.label")}
        </DialogTitle>
        <AssigneeOptionsMenu
          members={members.data ?? []}
          current={getTaskAssigneeIds(task)}
          onSelect={(id) => void select(id)}
          disabled={isPending}
          status={
            members.isError ? (
              <div role="alert" className="space-y-2">
                <p>{t("settings:adminWorkspaces.members.loadError")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void members.refetch()}
                >
                  {t("common:error.tryAgain")}
                </Button>
              </div>
            ) : members.isPending ? (
              t("common:empty.loading")
            ) : undefined
          }
        />
      </DialogPopup>
    </Dialog>
  );
}
