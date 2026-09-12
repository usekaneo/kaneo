"use client";

import { Plus } from "lucide-react";
import { PublicTaskCard } from "@/components/project-task-card";
import { DEFAULT_COLUMNS } from "@/constants/columns";
import { getColumnIcon } from "@/lib/column";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

type PrivateKanbanViewProps = {
  project: ProjectWithTasks;
  onTaskClick: (task: Task) => void;
};

export function PrivateKanbanView({
  project,
  onTaskClick,
}: PrivateKanbanViewProps) {
  const columns = DEFAULT_COLUMNS.map((col) => ({
    ...col,
    tasks:
      project.columns?.find((c: { id: string }) => c.id === col.id)?.tasks ??
      [],
    isFinal:
      project.columns?.find((c: { id: string }) => c.id === col.id)?.isFinal ??
      false,
  }));

  return (
    <div className="flex-1 min-h-0 overflow-x-hidden md:overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch]">
      <div className="flex gap-3 p-3 h-full min-w-max bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70">
        {columns.map((column) => (
          <div
            key={column.id}
            className="h-full max-w-96 min-w-80 shrink-0 flex-1"
          >
            {/* Column wrapper (private style) */}
            <div className="group relative flex h-full min-h-0 w-full flex-col rounded-xl border transition-all duration-300 ease-out border-border/70 bg-muted/40 shadow-xs/5 hover:border-border/90 dark:bg-card/90">
              {/* Column header */}
              <div className="shrink-0 border-b border-border/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-muted-foreground">
                      {getColumnIcon(column.id, column.isFinal)}
                    </span>
                    <span className="truncate text-sm font-medium text-foreground/95">
                      {column.name}
                    </span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {column.tasks.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Task list */}
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 flex flex-col gap-1.5">
                {column.tasks.map((task: Task) => (
                  <PublicTaskCard
                    key={task.id}
                    task={task}
                    projectSlug={project.slug}
                    isCompleted={column.isFinal}
                    onTaskClick={onTaskClick}
                  />
                ))}
              </div>

              {/* Add task footer, revealed on column hover */}
              <div className="shrink-0 border-t border-border/60 p-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                <button
                  type="button"
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add task
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
