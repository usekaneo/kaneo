import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import messages from "../../../../../i18n/en-US.json";
import { AssignedTaskRow } from "./assigned-task-row";
import type { AssignedTask } from "./assigned-tasks";
import { groupByDueDate, groupByProject } from "./group-assigned-tasks";
import { PreviewPageHeader } from "./page-header";

type GroupBy = "dueDate" | "project";

const copy = messages.workspace;

// apps/web's My tasks: everything assigned to you, grouped.
export function MyTasksView({
  tasks,
  onTaskClick,
}: {
  tasks: AssignedTask[];
  onTaskClick: (task: AssignedTask) => void;
}) {
  const [groupBy, setGroupBy] = useState<GroupBy>("dueDate");
  const groups =
    groupBy === "project" ? groupByProject(tasks) : groupByDueDate(tasks);
  const options: Array<{ value: GroupBy; label: string }> = [
    { value: "dueDate", label: copy.myTasks.groupBy.dueDate },
    { value: "project", label: copy.myTasks.groupBy.project },
  ];

  return (
    <>
      <PreviewPageHeader
        title={copy.myTasks.pageTitle}
        actions={
          <fieldset className="inline-flex items-center gap-0.5">
            <legend className="sr-only">{copy.myTasks.groupBy.label}</legend>
            {options.map((option) => (
              <Button
                key={option.value}
                variant={groupBy === option.value ? "secondary" : "ghost"}
                size="xs"
                aria-pressed={groupBy === option.value}
                onClick={() => setGroupBy(option.value)}
                className={cn(
                  groupBy !== option.value && "text-muted-foreground",
                )}
              >
                {option.label}
              </Button>
            ))}
          </fieldset>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.map((group) => (
          <section key={group.id}>
            <h2 className="flex h-9 items-center gap-2 border-b border-border/50 bg-muted/40 px-5 text-[13px]">
              <span
                className={cn(
                  "font-semibold",
                  group.bucket === "overdue"
                    ? "text-destructive-foreground"
                    : "text-foreground",
                )}
              >
                {group.bucket ? copy.myWork.due[group.bucket] : group.title}
              </span>
              <span className="text-xs font-normal tabular-nums text-muted-foreground">
                {group.tasks.length}
              </span>
            </h2>
            <div className="flex flex-col px-4">
              {group.tasks.map((task) => (
                <AssignedTaskRow
                  key={task.id}
                  task={task}
                  showLabels
                  onTaskClick={onTaskClick}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
