"use client";

import { Plus } from "lucide-react";
import { DEFAULT_COLUMNS } from "@/constants/columns";
import { getColumnIcon } from "@/lib/column";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import messages from "../../../../../i18n/en-US.json";
import type { PreviewTaskDetails } from "./mock-data";
import { PreviewTaskCard } from "./task-card";

type PreviewBoardProps = {
  project: ProjectWithTasks;
  onTaskClick: (task: Task) => void;
  details: Record<string, PreviewTaskDetails>;
};

export function PreviewBoard({
  project,
  onTaskClick,
  details,
}: PreviewBoardProps) {
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
            data-column-id={column.id}
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
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
                <div className="flex flex-col gap-2">
                  {column.tasks.map((task: Task) => (
                    <PreviewTaskCard
                      key={task.id}
                      task={task}
                      details={details[task.id]}
                      projectSlug={project.slug}
                      isCompleted={column.isFinal}
                      onTaskClick={onTaskClick}
                    />
                  ))}
                </div>
                {/* New work starts in an open column; finished ones only collect. */}
                {!column.isFinal && (
                  <button
                    type="button"
                    className="mt-1 flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-[13px] text-muted-foreground outline-none transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Plus aria-hidden="true" className="size-3.5" />
                    {messages.tasks.kanban.addTask}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
