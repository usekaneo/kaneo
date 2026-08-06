"use client";

import { format } from "date-fns";
import {
  Archive,
  Calendar,
  CalendarClock,
  CalendarX,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { PublicTaskLabels } from "@/components/project-task-labels";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DEFAULT_COLUMNS } from "@/constants/columns";
import { getColumnIcon } from "@/lib/column";
import { dueDateStatusColors, getDueDateStatus } from "@/lib/due-date-status";
import { getPriorityIcon } from "@/lib/priority";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

type PrivateListViewProps = {
  project: ProjectWithTasks;
  onTaskClick: (task: Task) => void;
};

export function PrivateListView({
  project,
  onTaskClick,
}: PrivateListViewProps) {
  const columns = DEFAULT_COLUMNS.map((col) => ({
    ...col,
    tasks: project.columns?.find((c) => c.id === col.id)?.tasks ?? [],
    isFinal: project.columns?.find((c) => c.id === col.id)?.isFinal ?? false,
  }));

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(columns.map((c) => [c.id, true])),
  );

  const toggleSection = (id: string) =>
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
      <div className="flex flex-col divide-y divide-border/50">
        {columns.map((column) => {
          const isOpen = openSections[column.id] ?? true;
          return (
            <div key={column.id}>
              {/* Section header */}
              <div className="flex items-center gap-2 py-2 px-4 bg-muted/60 border-b border-border/50">
                <button
                  type="button"
                  onClick={() => toggleSection(column.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left group"
                >
                  <ChevronRight
                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
                  />
                  <span className="text-muted-foreground">
                    {getColumnIcon(column.id, column.isFinal)}
                  </span>
                  <span className="text-xs font-medium text-foreground/90 truncate">
                    {column.name}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {column.tasks.length}
                  </span>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  {column.isFinal && (
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Task rows */}
              {isOpen && (
                <div>
                  {column.tasks.map((task) => {
                    const taskIsCompleted = column.isFinal;
                    const taskWithLabels = task as Task & {
                      labels?: Array<{
                        id: string;
                        name: string;
                        color: string;
                      }>;
                    };
                    const labels = taskWithLabels.labels ?? [];

                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => onTaskClick(task)}
                        className="w-full text-left flex items-center gap-3 px-4 py-2.5 border-b border-border/50 transition-colors cursor-pointer hover:bg-accent/60"
                      >
                        {/* Priority */}
                        {task.priority && (
                          <span className="shrink-0 text-muted-foreground">
                            {getPriorityIcon(task.priority)}
                          </span>
                        )}

                        {/* Task number */}
                        <span className="shrink-0 text-[10px] font-mono text-muted-foreground">
                          {project.slug}-{task.number}
                        </span>

                        {/* Title + labels */}
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="text-sm text-foreground truncate">
                            {task.title}
                          </span>
                          {labels.length > 0 && (
                            <PublicTaskLabels labels={labels} />
                          )}
                        </div>

                        {/* Assignee */}
                        {task.assigneeName && (
                          <div className="shrink-0 flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                              <AvatarImage
                                src={task.assigneeImage ?? ""}
                                alt={task.assigneeName ?? ""}
                              />
                              <AvatarFallback className="text-[10px] font-medium border border-border/30">
                                {task.assigneeName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        )}

                        {/* Due date */}
                        {task.dueDate && (
                          <div
                            className={`shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded ${dueDateStatusColors[getDueDateStatus(task.dueDate, taskIsCompleted)]}`}
                          >
                            {getDueDateStatus(task.dueDate, taskIsCompleted) ===
                              "overdue" && <CalendarX className="w-3 h-3" />}
                            {getDueDateStatus(task.dueDate, taskIsCompleted) ===
                              "due-soon" && (
                              <CalendarClock className="w-3 h-3" />
                            )}
                            {(getDueDateStatus(
                              task.dueDate,
                              taskIsCompleted,
                            ) === "far-future" ||
                              getDueDateStatus(
                                task.dueDate,
                                taskIsCompleted,
                              ) === "no-due-date") && (
                              <Calendar className="w-3 h-3" />
                            )}
                            <span>
                              {format(new Date(task.dueDate), "MMM d")}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
