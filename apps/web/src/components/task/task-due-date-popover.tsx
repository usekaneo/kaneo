import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import type Task from "@/types/task";
import { useState } from "react";
import { toast } from "sonner";

interface TaskDueDatePopoverProps {
  task: Task;
  children: React.ReactNode;
}

export default function TaskDueDatePopover({
  task,
  children,
}: TaskDueDatePopoverProps) {
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTask } = useUpdateTask();

  const handleDateChange = async (date: Date | undefined) => {
    try {
      await updateTask({
        ...task,
        dueDate: date?.toISOString() || null,
      });
      toast.success("Task due date updated successfully");
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update task due date",
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="single"
          selected={task.dueDate ? new Date(task.dueDate) : undefined}
          onSelect={handleDateChange}
          className="w-full bg-popover"
        />
      </PopoverContent>
    </Popover>
  );
}
