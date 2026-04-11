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
import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { useNumberedShortcuts } from "@/hooks/use-numbered-shortcuts";
import { getColumnIcon } from "@/lib/column";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type SubtaskStatusPopoverProps = {
  tasks: Task[];
  projectId: string;
  children: React.ReactNode;
};

export default function SubtaskStatusPopover({
  tasks,
  projectId,
  children,
}: SubtaskStatusPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: columns = [] } = useGetColumns(projectId);
  const statusOptions = columns.map((col) => ({
    value: col.slug,
    label: col.name,
    isFinal: col.isFinal,
  }));
  const { mutateAsync: updateTaskStatus } = useUpdateTaskStatus();

  const allSameStatus =
    tasks.length > 0 && tasks.every((t) => t.status === tasks[0].status);
  const currentStatus = allSameStatus ? tasks[0].status : null;

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      try {
        await Promise.all(
          tasks.map((task) =>
            updateTaskStatus({
              ...task,
              status: newStatus,
            }),
          ),
        );
        setOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:popover.status.updateError"),
        );
      }
    },
    [t, tasks, updateTaskStatus],
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
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <div>
          {statusOptions.map((status, index) => (
            <Button
              key={status.value}
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-8 px-2 rounded-none first:rounded-t-md last:rounded-b-md"
              onClick={() => handleStatusChange(status.value)}
            >
              {getColumnIcon(status.value, status.isFinal)}
              <span className="text-sm">{status.label}</span>
              {currentStatus === status.value ? (
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
