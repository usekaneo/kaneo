import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import { getColumnIcon } from "@/lib/column";
import type Task from "@/types/task";

interface TaskStatusPopoverProps {
  task: Task;
  children: React.ReactNode;
}

const statusOptions = [
  { value: "to-do", label: "To Do" },
  { value: "in-progress", label: "In Progress" },
  { value: "in-review", label: "In Review" },
  { value: "done", label: "Done" },
];

export default function TaskStatusPopover({
  task,
  children,
}: TaskStatusPopoverProps) {
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTaskStatus } = useUpdateTaskStatus();

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateTaskStatus({
        ...task,
        status: newStatus,
      });
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update task status",
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="space-y-1">
          {statusOptions.map((status) => (
            <Button
              key={status.value}
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-8 px-2"
              onClick={() => handleStatusChange(status.value)}
            >
              {getColumnIcon(status.value)}
              <span className="text-sm">{status.label}</span>
              {task.status === status.value && (
                <Check className="ml-auto h-4 w-4" />
              )}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
