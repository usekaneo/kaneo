import { Check } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ShortcutNumber } from "@/components/ui/shortcut-number";
import { useUpdateTaskPriority } from "@/hooks/mutations/task/use-update-task-status-priority";
import { useNumberedShortcuts } from "@/hooks/use-numbered-shortcuts";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskPriorityPopoverProps = {
  task: Task;
  children: React.ReactNode;
};

const priorityOptions = [
  { value: "no-priority", label: "No Priority" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export default function TaskPriorityPopover({
  task,
  children,
}: TaskPriorityPopoverProps) {
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTaskPriority } = useUpdateTaskPriority();

  const handlePriorityChange = useCallback(
    async (newPriority: string) => {
      try {
        await updateTaskPriority({
          ...task,
          priority: newPriority,
        });
        setOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to update task priority",
        );
      }
    },
    [task, updateTaskPriority],
  );

  const shortcutOptions = useMemo(
    () =>
      priorityOptions.map((priority) => ({
        onSelect: () => handlePriorityChange(priority.value),
      })),
    [handlePriorityChange],
  );

  useNumberedShortcuts(open, shortcutOptions);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="space-y-1">
          {priorityOptions.map((priority, index) => (
            <Button
              key={priority.value}
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-8 px-2"
              onClick={() => handlePriorityChange(priority.value)}
            >
              {getPriorityIcon(priority.value)}
              <span className="text-sm">{priority.label}</span>
              {task.priority === priority.value ? (
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
