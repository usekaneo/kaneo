import type { LucideIcon } from "lucide-react";
import { DEFAULT_COLUMNS } from "@/constants/columns";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { PublicTaskRow } from "./task-row";

interface Column {
  id: string;
  name: string;
  icon: LucideIcon;
  tasks: Task[];
}

interface PublicListViewProps {
  project: ProjectWithTasks;
  onTaskClick: (task: Task) => void;
}

export function PublicListView({ project, onTaskClick }: PublicListViewProps) {
  const columns: Column[] = DEFAULT_COLUMNS.map((column) => ({
    ...column,
    tasks: project.columns?.find((col) => col.id === column.id)?.tasks || [],
  }));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-6 space-y-8 max-w-5xl mx-auto">
        {columns.map((column) => {
          const IconComponent = column.icon;
          return (
            <div key={column.id} className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <IconComponent className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
                  {column.name}
                </h3>
                <span className="text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-3 py-1 rounded-full font-medium">
                  {column.tasks.length}
                </span>
              </div>

              <div className="space-y-3">
                {column.tasks.map((task) => (
                  <PublicTaskRow
                    key={task.id}
                    task={task}
                    projectSlug={project.slug}
                    onTaskClick={onTaskClick}
                  />
                ))}

                {column.tasks.length === 0 && (
                  <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
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
  );
}
