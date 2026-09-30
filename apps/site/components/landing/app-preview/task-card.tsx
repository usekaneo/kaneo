import { format } from "date-fns";
import { Calendar, SlidersHorizontal, SquareCheck } from "lucide-react";
import { PublicTaskLabels } from "@/components/project-task-labels";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { dueDateStatusColors, getDueDateStatus } from "@/lib/due-date-status";
import { getPriorityIcon } from "@/lib/priority";
import { cn } from "@/lib/utils";
import messages from "../../../../../i18n/en-US.json";
import type { PreviewTaskDetails, TaskWithExtras } from "./mock-data";

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
  return (
    <button
      type="button"
      data-task-id={task.id}
      onClick={() => onTaskClick(task)}
      className="group relative w-full rounded-lg border border-border bg-background p-3 text-left shadow-xs/5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {projectSlug}-{task.number}
        </span>
        <Avatar
          className="h-5 w-5"
          title={
            task.assigneeName ??
            messages.common.modals.createTask.assignUnassigned
          }
        >
          <AvatarFallback className="border border-border/30 text-[10px] font-medium">
            {task.assigneeName
              ?.split(" ")
              .map((name) => name[0])
              .join("") ?? "?"}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="mb-2.5 line-clamp-3 break-words pr-6 text-[15px] font-medium leading-5 text-foreground/95">
        {task.title}
      </div>
      {!!task.labels?.length && (
        <div className="mb-2.5">
          <PublicTaskLabels labels={task.labels} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex h-5.5 items-center rounded border border-border/70 bg-muted/55 px-2 py-1 text-[10px] text-muted-foreground">
          {getPriorityIcon(task.priority ?? "")}
        </span>
        {fields.length > 0 && (
          <span
            title={fields
              .map((field) => `${field.name}: ${field.value}`)
              .join(" · ")}
            className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/55 px-2 py-1 text-[10px] text-muted-foreground"
          >
            <SlidersHorizontal className="size-3" />
            {fields.length}
          </span>
        )}
        {!!details?.checklist.length && (
          <span
            className={cn(
              "flex h-5.5 items-center gap-1 rounded bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground",
              completed === details.checklist.length &&
                "bg-success/10 text-success-foreground",
            )}
          >
            <SquareCheck className="size-3" />
            {completed}/{details.checklist.length}
          </span>
        )}
        {task.dueDate && (
          <span
            className={cn(
              "flex h-5.5 items-center gap-1 rounded px-2 py-1 text-[10px]",
              dueDateStatusColors[getDueDateStatus(task.dueDate, isCompleted)],
            )}
          >
            <Calendar className="size-3" />
            {format(new Date(task.dueDate), "MMM d")}
          </span>
        )}
      </div>
    </button>
  );
}
