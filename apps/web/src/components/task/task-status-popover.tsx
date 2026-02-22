import { Check } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ShortcutNumber } from "@/components/ui/shortcut-number";
import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import { useNumberedShortcuts } from "@/hooks/use-numbered-shortcuts";
import { getColumnIcon } from "@/lib/column";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import type Task from "@/types/task";

type TaskStatusPopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskStatusPopover({
  task,
  children,
}: TaskStatusPopoverProps) {
  const [open, setOpen] = useState(false);
  const { project } = useProjectStore();
  const statusOptions =
    project?.columns?.map((col) => ({
      value: col.id,
      label: col.name,
      isFinal: col.isFinal,
    })) ?? [];
  const { mutateAsync: updateTaskStatus } = useUpdateTaskStatus();

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      try {
        await updateTaskStatus({
          ...task,
          status: newStatus,
        });
        setOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to update task status",
        );
      }
    },
    [task, updateTaskStatus],
  );

  const shortcutOptions = useMemo(
    () =>
      statusOptions.map((status) => ({
        onSelect: () => handleStatusChange(status.value),
      })),
    [handleStatusChange, statusOptions],
  );

  useNumberedShortcuts(open, shortcutOptions);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="space-y-1">
          {statusOptions.map((status, index) => (
            <Button
              key={status.value}
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-8 px-2"
              onClick={() => handleStatusChange(status.value)}
            >
              {getColumnIcon(status.value, status.isFinal)}
              <span className="text-sm">{status.label}</span>
              {task.status === status.value ? (
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
