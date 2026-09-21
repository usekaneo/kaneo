import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import useUpdateTimeEntry from "@/hooks/mutations/time-entry/use-update-time-entry";
import { formatDuration } from "@/lib/format";
import { getInitials } from "@/lib/get-initials";
import { toast } from "@/lib/toast";
import TimeEntryForm, { type TimeEntryFormValue } from "./time-entry-form";
import type { TimeEntryItem } from "./time-entry-row";

type TimeEntryEditPopoverProps = {
  entry: TimeEntryItem;
  taskId: string;
  taskTitle: string;
  displayName: string;
  avatarSrc?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

/**
 * Layer 3: edit surface anchored to its time entry row. A popover, never a
 * centered modal, so the entry list and its expanded groups stay in place
 * underneath and dismissal returns to them untouched. The form is the shared
 * entry editor, preloaded with the saved entry.
 */
export default function TimeEntryEditPopover({
  entry,
  taskId,
  taskTitle,
  displayName,
  avatarSrc,
  open,
  onOpenChange,
  children,
}: TimeEntryEditPopoverProps) {
  const { t } = useTranslation();
  const { mutateAsync: updateTimeEntry, isPending } =
    useUpdateTimeEntry(taskId);

  const handleSave = async (value: TimeEntryFormValue) => {
    try {
      await updateTimeEntry({
        id: entry.id,
        startTime: value.start.toISOString(),
        endTime: value.end.toISOString(),
        // Passed through as-is, so clearing the field stores empty instead
        // of preserving the old text.
        description: value.notes,
        billable: value.billable,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:timeTracking.updateError"),
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-70 p-3" align="start">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={avatarSrc ?? ""} alt={displayName} />
            <AvatarFallback className="text-xs font-medium">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {displayName} · {formatDuration(entry.duration ?? 0)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {taskTitle}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <TimeEntryForm
            key={entry.id}
            initialStart={new Date(entry.startTime)}
            initialEnd={
              entry.endTime
                ? new Date(entry.endTime)
                : new Date(entry.startTime)
            }
            initialNotes={entry.description ?? ""}
            initialBillable={entry.billable}
            isPending={isPending}
            onSave={(value) => void handleSave(value)}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
