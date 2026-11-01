import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskAssignee } from "@/hooks/mutations/task/use-update-task-assignee";
import useGetProjectMembers from "@/hooks/queries/workspace-users/use-get-project-members";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import {
  getTaskAssigneeIds,
  sameAssigneeSet,
  toggleAssignee,
} from "@/lib/task-assignees";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";
import { assigneeMenuOptions } from "./menus/assignee-menu-options";

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
  const [draft, setDraft] = useState<string[] | null>(null);
  const { mutateAsync: updateTaskAssignee } = useUpdateTaskAssignee();
  const { data: members = [] } = useGetProjectMembers({
    workspaceId,
    projectId: task.projectId,
  });
  const { canAssignTasks } = useWorkspacePermission();

  if (!canAssignTasks()) return <>{children}</>;

  const currentIds = getTaskAssigneeIds(task);

  // Toggling only edits a draft; the set is saved once when the popover closes.
  const toggle = (userId: string) =>
    setDraft((ids) => toggleAssignee(ids ?? currentIds, userId));

  const save = async (ids: string[]) => {
    try {
      await updateTaskAssignee({
        ...task,
        userId: ids[0] ?? null,
        replaceAssigneeIds: ids,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.assignee.updateError"),
      );
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setDraft(null);
      return;
    }
    if (draft && !sameAssigneeSet(draft, currentIds)) void save(draft);
    setDraft(null);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <OptionMenu
          label={t("tasks:assignee.label")}
          placeholder={t("tasks:bulk.assigneePlaceholder")}
          options={assigneeMenuOptions(
            members,
            draft ?? currentIds,
            t("tasks:popover.assignee.unassigned"),
          )}
          onSelect={toggle}
          multiple
        />
      </PopoverContent>
    </Popover>
  );
}
