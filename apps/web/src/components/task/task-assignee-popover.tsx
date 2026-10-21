import { getTaskAssigneeIds } from "@/lib/get-task-assignee-ids";
import { AssigneeOptionsMenu } from "./menus/assignee-options-menu";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskAssignee } from "@/hooks/mutations/task/use-update-task-assignee";
import useGetProjectMembers from "@/hooks/queries/workspace-users/use-get-project-members";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskAssigneePopoverProps = {
  task: Task;
  workspaceId: string;
  children: React.ReactNode;
};

export default function TaskAssigneePopover({
  task,
  workspaceId,
  children,
}: TaskAssigneePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTaskAssignee, isPending } =
    useUpdateTaskAssignee();
  const { data: members = [] } = useGetProjectMembers({
    workspaceId,
    projectId: task.projectId,
  });
  const { canAssignTasks } = useWorkspacePermission();

  if (!canAssignTasks()) return <>{children}</>;

  const changeAssignee = async (userId: string) => {
    if (isPending) return;
    try {
      await updateTaskAssignee({
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <AssigneeOptionsMenu
          members={members}
          current={getTaskAssigneeIds(task)}
          onSelect={changeAssignee}
          disabled={isPending}
        />
      </PopoverContent>
    </Popover>
  );
}
