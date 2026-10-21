import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import { assigneeMenuOptions } from "@/components/task/menus/assignee-menu-options";
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
  const [query, setQuery] = useState("");
  const options = assigneeMenuOptions(
    members.data ?? [],
    task.userId,
    t("tasks:popover.assignee.unassigned"),
  );
  const unassigned = { ...options[0]!, pinned: true };
  const people = options.slice(1);

  const select = async (userId: string) => {
    if (isPending || members.isPending || members.isError) return;
    try {
      await mutateAsync({ ...task, userId });
      onClose();
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
        <OptionMenu
          label={t("tasks:assignee.label")}
          placeholder={t("tasks:bulk.assigneePlaceholder")}
          options={
            query.trim() ? [...people, unassigned] : [unassigned, ...people]
          }
          onQueryChange={setQuery}
          onSelect={(userId) => void select(userId)}
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
            ) : members.isPending || isPending ? (
              t("common:empty.loading")
            ) : undefined
          }
        />
      </DialogPopup>
    </Dialog>
  );
}
