import { Check } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ShortcutNumber } from "@/components/ui/shortcut-number";
import { useUpdateTaskType } from "@/hooks/mutations/task/use-update-task-type";
import useGetProject from "@/hooks/queries/project/use-get-project";
import { useNumberedShortcuts } from "@/hooks/use-numbered-shortcuts";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getTaskTypeLabel } from "@/lib/i18n/domain";
import { getTaskTypesForProject } from "@/lib/task-type";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskTypePopoverProps = {
  task: Task;
  workspaceId: string;
  children: React.ReactNode;
};

export default function TaskTypePopover({
  task,
  workspaceId,
  children,
}: TaskTypePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTaskType } = useUpdateTaskType();
  const { canManageTasks } = useWorkspacePermission();
  const { data: project } = useGetProject({
    id: task.projectId,
    workspaceId,
  });
  const canEdit = canManageTasks();

  const taskTypeOptions = useMemo(
    () =>
      getTaskTypesForProject(project?.projectType).map((value) => ({
        value,
        label: getTaskTypeLabel(value),
      })),
    [project?.projectType],
  );

  const handleTaskTypeChange = useCallback(
    async (newTaskType: string) => {
      try {
        await updateTaskType({
          ...task,
          taskType: newTaskType,
        });
        setOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:popover.taskType.updateError", {
                defaultValue: "Falha ao atualizar tipo da tarefa",
              }),
        );
      }
    },
    [task, t, updateTaskType],
  );

  const shortcutOptions = useMemo(
    () =>
      taskTypeOptions.map((option) => ({
        onSelect: () => handleTaskTypeChange(option.value),
      })),
    [handleTaskTypeChange, taskTypeOptions],
  );

  useNumberedShortcuts(open, shortcutOptions);

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-52 p-0 max-h-64 overflow-y-auto"
        align="start"
      >
        <div>
          {taskTypeOptions.map((option, index) => (
            <Button
              key={option.value}
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-8 px-2 rounded-none first:rounded-t-md last:rounded-b-md"
              onClick={() => handleTaskTypeChange(option.value)}
            >
              <span className="text-sm">{option.label}</span>
              {task.taskType === option.value ? (
                <Check className="ml-auto h-4 w-4" />
              ) : (
                <ShortcutNumber number={index + 1} />
              )}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
