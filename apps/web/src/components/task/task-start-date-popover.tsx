import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskStartDatePopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskStartDatePopover({
  task,
  children,
}: TaskStartDatePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTask } = useUpdateTask();

  const handleDateChange = async (date: Date | undefined) => {
    try {
      await updateTask({
        ...task,
        startDate: date?.toISOString() || null,
      });
      toast.success(t("tasks:popover.startDate.updateSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.startDate.updateError"),
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="single"
          selected={task.startDate ? new Date(task.startDate) : undefined}
          onSelect={handleDateChange}
          disabled={
            task.dueDate ? { after: new Date(task.dueDate) } : undefined
          }
          className="w-full bg-popover"
        />
        {task.startDate && (
          <div className="pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => handleDateChange(undefined)}
            >
              <X className="h-4 w-4" />
              {t("tasks:popover.startDate.clear")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
