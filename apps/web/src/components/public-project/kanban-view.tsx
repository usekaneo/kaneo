import type { LucideIcon } from "lucide-react";
import { DEFAULT_COLUMNS } from "@/constants/columns";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { PublicTaskCard } from "./task-card";

type Column = {
  id: string;
  name: string;
  icon: LucideIcon;
  tasks: Task[];
};

type PublicKanbanViewProps = {
  project: ProjectWithTasks;
  onTaskClick: (task: Task) => void;
};

export function PublicKanbanView({
  project,
  onTaskClick,
}: PublicKanbanViewProps) {
  const columns: Column[] = DEFAULT_COLUMNS.map((column) => ({
    ...column,
    tasks: project.columns?.find((col) => col.id === column.id)?.tasks || [],
  }));

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <div className="h-full overflow-x-auto overflow-y-hidden">
        <div className="flex gap-6 p-6 h-full min-w-max">
          {columns.map((column) => {
            const IconComponent = column.icon;
            return (
              <div
                key={column.id}
                className="w-80 flex flex-col bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-700/50 overflow-hidden flex-1"
              >
                <div className="px-4 py-3 bg-white dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700/50">
                  <div className="flex items-center gap-2">
                    <IconComponent className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {column.name}
                    </h3>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded-full font-medium">
                      {column.tasks.length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-0">
                  {column.tasks.map((task) => (
                    <PublicTaskCard
                      key={task.id}
                      task={task}
                      projectSlug={project.slug}
                      onTaskClick={onTaskClick}
                    />
                  ))}

                  {column.tasks.length === 0 && (
                    <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-12 px-4">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-2">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      No tasks in {column.name.toLowerCase()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
