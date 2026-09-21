import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { TimeEntryItem } from "@/fetchers/time-entry/get-time-entries";
import { formatDuration, formatElapsed, formatEntryRange } from "@/lib/format";
import { getInitials } from "@/lib/get-initials";
import TimeEntryEditPopover from "./time-entry-edit-popover";

type WorkspaceMember = {
  userId: string;
  user?: {
    id?: string;
    name?: string | null;
    image?: string | null;
  } | null;
};

export function resolveEntryMember(
  members: WorkspaceMember[] | undefined,
  userId: string | null,
) {
  return members?.find((item) => item.userId === userId);
}

type TimeEntryRowProps = {
  entry: TimeEntryItem;
  taskTitle: string;
  members: WorkspaceMember[] | undefined;
  canEdit: boolean;
  liveSeconds?: number;
  onDeleteRequest: (id: string) => void;
};

export default function TimeEntryRow({
  entry,
  taskTitle,
  members,
  canEdit,
  liveSeconds,
  onDeleteRequest,
}: TimeEntryRowProps) {
  const { t } = useTranslation();
  const [editOpen, setEditOpen] = useState(false);
  const member = resolveEntryMember(members, entry.userId);
  const displayName =
    member?.user?.name ?? entry.userName ?? t("common:people.someone");
  const isRunning = entry.endTime === null;
  const seconds = isRunning ? (liveSeconds ?? 0) : (entry.duration ?? 0);

  const rowBody = (
    <>
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarImage src={member?.user?.image ?? ""} alt={displayName} />
        <AvatarFallback className="text-[10px] font-medium">
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] text-muted-foreground">
          {isRunning
            ? formatElapsed(seconds)
            : formatEntryRange(
                entry.startTime,
                entry.endTime ?? entry.startTime,
              )}
        </span>
        {entry.description && (
          <span className="block truncate text-[11px] text-muted-foreground/80">
            {entry.description}
          </span>
        )}
        <span className="block truncate text-xs font-medium text-foreground">
          {formatDuration(seconds)}
          {entry.billable && (
            <span className="ml-1 rounded bg-emerald-500/15 px-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              $
            </span>
          )}
        </span>
      </span>
    </>
  );

  // Running entries have no saved state to edit yet, and viewers cannot
  // open an editor whose save the API would reject, so both stay inert.
  if (isRunning || !canEdit) {
    return (
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
        {rowBody}
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-accent/50">
      <TimeEntryEditPopover
        entry={entry}
        taskId={entry.taskId}
        taskTitle={taskTitle}
        displayName={displayName}
        avatarSrc={member?.user?.image ?? undefined}
        open={editOpen}
        onOpenChange={setEditOpen}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {rowBody}
        </button>
      </TimeEntryEditPopover>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 shrink-0 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100"
        onClick={() => onDeleteRequest(entry.id)}
        aria-label={t("tasks:timeTracking.deleteEntry")}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
