import { format } from "date-fns";
import { Calendar, ChevronDown, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { PublicTaskLabels } from "@/components/project-task-labels";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { getColumnIcon } from "@/lib/column";
import { getPriorityIcon } from "@/lib/priority";
import messages from "../../../../../i18n/en-US.json";
import type { PreviewTaskDetails, TaskWithExtras } from "./mock-data";

// An embedded, non-modal version of the app's task sheet, confined to the preview.
export function PreviewTaskDetailsPanel({
  task,
  projectSlug,
  statusName,
  details,
  onChange,
  onClose,
}: {
  task: TaskWithExtras;
  projectSlug: string;
  statusName: string;
  details?: PreviewTaskDetails;
  onChange: (details: PreviewTaskDetails) => void;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <aside
      aria-labelledby={id}
      data-preview-task-panel
      className="absolute inset-y-0 right-0 z-30 flex w-[540px] flex-col border-l border-border bg-background shadow-2xl md:w-[720px]"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-sm font-medium text-muted-foreground">
          {projectSlug}-{task.number}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={messages.common.actions.close}
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-sidebar p-3 text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5">
          {getColumnIcon(task.status)}
          {statusName}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {getPriorityIcon(task.priority ?? "")}
          {
            messages.tasks.priority[
              task.priority as keyof typeof messages.tasks.priority
            ]
          }
        </span>
        {task.assigneeName && (
          <span className="inline-flex items-center gap-1.5">
            <Avatar className="size-4">
              <AvatarFallback className="text-[9px]">
                {task.assigneeName[0]}
              </AvatarFallback>
            </Avatar>
            {task.assigneeName}
          </span>
        )}
        {task.dueDate && (
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            {format(new Date(task.dueDate), "MMM d")}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-auto p-4">
        <div className="space-y-3">
          <h2
            id={id}
            ref={heading}
            tabIndex={-1}
            className="text-xl font-semibold tracking-tight outline-none"
          >
            {task.title}
          </h2>
          <p className="text-sm leading-6 text-foreground/85">
            {task.description}
          </p>
          {details?.checklist.map((item) => (
            <div
              key={item.id}
              className="flex cursor-pointer items-center gap-2 text-sm leading-6"
            >
              <Checkbox
                id={`${id}-check-${item.id}`}
                checked={item.completed}
                onCheckedChange={(checked) =>
                  onChange({
                    ...details,
                    checklist: details.checklist.map((entry) =>
                      entry.id === item.id
                        ? { ...entry, completed: checked === true }
                        : entry,
                    ),
                  })
                }
              />
              <label
                htmlFor={`${id}-check-${item.id}`}
                className={
                  item.completed ? "text-muted-foreground line-through" : ""
                }
              >
                {item.title}
              </label>
            </div>
          ))}
          <PublicTaskLabels labels={task.labels ?? []} />
        </div>
        {!!details?.fields.length && (
          <details
            open
            className="rounded-lg border border-border bg-sidebar/30 px-4"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm font-semibold">
              {messages.tasks.common.customFields}
              <ChevronDown className="size-4 text-muted-foreground" />
            </summary>
            <div className="grid grid-cols-2 gap-4 pb-4">
              {details.fields.map((field) => (
                <div key={field.id} className="space-y-1.5">
                  <label
                    htmlFor={`${id}-${field.id}`}
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {field.name}
                  </label>
                  <Input
                    id={`${id}-${field.id}`}
                    type={field.type}
                    value={field.value}
                    className="h-9 bg-background text-sm"
                    onChange={(event) =>
                      onChange({
                        ...details,
                        fields: details.fields.map((entry) =>
                          entry.id === field.id
                            ? { ...entry, value: event.target.value }
                            : entry,
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </aside>
  );
}
