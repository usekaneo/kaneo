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
import useGetMembersOfProjects from "@/hooks/queries/workspace-users/use-get-members-of-projects";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type SubtaskAssigneePopoverProps = {
  tasks: Task[];
  workspaceId: string;
  children: React.ReactNode;
};

export default function SubtaskAssigneePopover({
  tasks,
  workspaceId,
  children,
}: SubtaskAssigneePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTaskAssignee, isPending } =
    useUpdateTaskAssignee();
  const { data: members = [] } = useGetMembersOfProjects({
    workspaceId,
    projectIds: tasks.map((task) => task.projectId),
  });
  const { canAssignTasks } = useWorkspacePermission();

  if (!canAssignTasks()) return <>{children}</>;

  const common = (tasks[0] ? getTaskAssigneeIds(tasks[0]) : []).filter((id) =>
    tasks.every((task) => getTaskAssigneeIds(task).includes(id)),
  );

  const current =
    common.length ||
    tasks.every((task) => getTaskAssigneeIds(task).length === 0)
      ? common
      : undefined;

  const changeAssignee = async (userId: string) => {
    if (isPending) return;
    try {
      await Promise.all(
        tasks.map((task) =>
          updateTaskAssignee({
            ...task,
            userId,
            assigneeMode: userId
              ? common.includes(userId)
                ? "remove"
                : "add"
              : "set",
            assigneeIds: [],
          }),
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.assignee.updateError"),
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <AssigneeOptionsMenu
          members={members}
          current={current}
          onSelect={changeAssignee}
          disabled={isPending}
        />
      </PopoverContent>
    </Popover>
  );
}
