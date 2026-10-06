import { format } from "date-fns";
import {
  Calendar,
  CalendarClock,
  CalendarX,
  SlidersHorizontal,
  SquareCheck,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { type DueDateStatus, getDueDateStatus } from "@/lib/due-date-status";
import { getPriorityIcon } from "@/lib/priority";
import { cn } from "@/lib/utils";
import messages from "../../../../../i18n/en-US.json";
import type { PreviewTaskDetails, TaskWithExtras } from "./mock-data";
import { PreviewTaskLabels } from "./task-labels";

const dueDateTextColors: Record<DueDateStatus, string> = {
  overdue: "text-destructive-foreground",
  "due-soon": "text-warning-foreground",
  "far-future": "text-muted-foreground",
  "no-due-date": "text-muted-foreground",
};

const dueDateIcons: Record<DueDateStatus, typeof Calendar> = {
  overdue: CalendarX,
  "due-soon": CalendarClock,
  "far-future": Calendar,
  "no-due-date": Calendar,
};

// Same card hierarchy and metadata as apps/web's kanban-board/task-card.
export function PreviewTaskCard({
  task,
  details,
  projectSlug,
  isCompleted,
  onTaskClick,
}: {
  task: TaskWithExtras;
  details?: PreviewTaskDetails;
  projectSlug: string;
  isCompleted: boolean;
  onTaskClick: (task: TaskWithExtras) => void;
}) {
  const completed =
    details?.checklist.filter((item) => item.completed).length ?? 0;
  const fields = details?.fields.filter((field) => field.value !== "") ?? [];
  const dueDateStatus = getDueDateStatus(task.dueDate, isCompleted);
  const isOverdue = dueDateStatus === "overdue";
  const hasPriority = Boolean(task.priority) && task.priority !== "no-priority";
  const DueDateIcon = dueDateIcons[dueDateStatus];

  return (
    <button
      type="button"
      data-task-id={task.id}
      onClick={() => onTaskClick(task)}
      className={cn(
        "group relative w-full rounded-lg border p-3 text-left transition-[background-color,border-color,box-shadow] duration-150 ease-out hover:bg-background hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        // Finished work steps back so open cards draw the eye.
        isCompleted ? "bg-background/60" : "bg-background shadow-xs/5",
        isOverdue
          ? "border-destructive/70 ring-[3px] ring-destructive/10"
          : "border-border hover:border-border/90",
      )}
    >
      <div className="mb-2 text-[11px] font-medium text-muted-foreground/90">
        {projectSlug}-{task.number}
      </div>
      <div className="absolute top-3 right-3">
        {task.assigneeName ? (
          <Avatar className="h-5 w-5" title={task.assigneeName}>
            <AvatarFallback className="border border-border/30 text-[10px] font-medium">
              {task.assigneeName
                .split(" ")
                .map((name) => name[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div
            className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-muted"
            title={messages.tasks.assignee.unassigned}
          >
            <span className="text-[10px] font-medium text-muted-foreground">
              ?
            </span>
          </div>
        )}
      </div>
      <div className={cn("pr-6", !isCompleted && "mb-2.5")}>
        <div
          className={cn(
            "line-clamp-3 break-words text-[15px] font-medium leading-5",
            isCompleted ? "text-muted-foreground" : "text-foreground/95",
          )}
        >
          {task.title}
        </div>
      </div>
      {!isCompleted && !!task.labels?.length && (
        <div className="mb-2.5">
          <PreviewTaskLabels labels={task.labels} />
        </div>
      )}
      {!isCompleted && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 empty:hidden">
          {hasPriority && (
            <span
              className="inline-flex h-5.5 items-center"
              title={
                messages.tasks.priority[
                  task.priority as keyof typeof messages.tasks.priority
                ]
              }
            >
              {getPriorityIcon(task.priority ?? "")}
            </span>
          )}
          {fields.length > 0 && (
            <span
              title={fields
                .map((field) => `${field.name}: ${field.value}`)
                .join(" · ")}
              className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium text-muted-foreground"
            >
              <SlidersHorizontal className="size-3" />
              {fields.length}
            </span>
          )}
          {!!details?.checklist.length && (
            <span
              className={cn(
                "inline-flex h-5.5 items-center gap-1 rounded border border-border/70 bg-muted/50 px-2 py-1 text-[10px] font-medium tabular-nums text-muted-foreground",
                completed === details.checklist.length &&
                  "border-success/20 bg-success/10 text-success-foreground",
              )}
            >
              <SquareCheck className="size-3" />
              {completed}/{details.checklist.length}
            </span>
          )}
          {task.dueDate && (
            <span
              className={cn(
                "flex h-5.5 items-center gap-1 text-[10px]",
                isOverdue && "font-medium",
                dueDateTextColors[dueDateStatus],
              )}
            >
              <DueDateIcon className="size-3" />
              {format(new Date(task.dueDate), "MMM d")}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
