import { Check } from "lucide-react";
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
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateShort } from "@/lib/format";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

// Mirrors VALID_TASK_CONSTRAINT_TYPES in apps/api/src/task/schema.ts.
export const TASK_CONSTRAINT_TYPES = [
  "none",
  "start_no_earlier_than",
  "finish_no_later_than",
  "must_start_on",
] as const;

export type TaskConstraintType = (typeof TASK_CONSTRAINT_TYPES)[number];

type TaskConstraintPopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskConstraintPopover({
  task,
  children,
}: TaskConstraintPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // A type the user just picked but hasn't confirmed a date for yet (only
  // relevant while switching to a non-"none" type with no existing date to
  // reuse) — reset whenever the popover closes so it never leaks a stale
  // selection into the next time it opens.
  const [pendingType, setPendingType] = useState<TaskConstraintType | null>(
    null,
  );
  const { mutateAsync: updateTask } = useUpdateTask();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  const committedType: TaskConstraintType =
    (task.constraintType as TaskConstraintType | undefined) ?? "none";
  const activeType = pendingType ?? committedType;

  const save = async (type: TaskConstraintType, date: Date | null) => {
    try {
      await updateTask({
        ...task,
        constraintType: type,
        constraintDate: date ? date.toISOString() : null,
      });
      toast.success(t("tasks:popover.constraint.updateSuccess"));
      setPendingType(null);
      if (type === "none" || date) {
        setOpen(false);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.constraint.updateError"),
      );
    }
  };

  const handleTypeSelect = (type: TaskConstraintType) => {
    if (type === committedType) return;
    if (type === "none") {
      save("none", null);
      return;
    }
    setPendingType(type);
    // Reuse the existing constraint date (switching e.g. SNET -> FNLT)
    // instead of forcing a re-pick when one is already set.
    if (task.constraintDate) {
      save(type, new Date(task.constraintDate));
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const type = activeType !== "none" ? activeType : null;
    if (!type) return;
    save(type, date);
  };

  if (!canEdit) return <>{children}</>;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPendingType(null);
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-1">
          {TASK_CONSTRAINT_TYPES.map((type) => (
            <Button
              key={type}
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-8 px-2 rounded-none first:rounded-t-md"
              onClick={() => handleTypeSelect(type)}
            >
              <span className="text-sm">
                {t(`tasks:popover.constraint.type.${type}`)}
              </span>
              {activeType === type && <Check className="ml-auto h-4 w-4" />}
            </Button>
          ))}
        </div>
        {activeType !== "none" && (
          <div className="border-t border-border p-2">
            <p className="px-1 pb-1 text-xs text-muted-foreground">
              {task.constraintDate && activeType === committedType
                ? t("tasks:popover.constraint.currentDate", {
                    date: formatDateShort(task.constraintDate),
                  })
                : t("tasks:popover.constraint.pickDate")}
            </p>
            <Calendar
              mode="single"
              selected={
                task.constraintDate && activeType === committedType
                  ? new Date(task.constraintDate)
                  : undefined
              }
              onSelect={handleDateSelect}
              className="w-full bg-popover"
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
