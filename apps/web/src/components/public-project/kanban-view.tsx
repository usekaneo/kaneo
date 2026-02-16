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
    <div className="flex-1 min-h-0 overflow-x-auto [-webkit-overflow-scrolling:touch]">
      <div className="flex gap-3 p-3 h-full min-w-max transition-all duration-200 ease-out">
        {columns.map((column) => {
          const IconComponent = column.icon;
          return (
            <div
              key={column.id}
              className="h-full flex-1 min-w-80 max-w-96 flex-shrink-0"
            >
              <div className="flex flex-col h-full w-full min-h-0 backdrop-blur-xs rounded-lg bg-sidebar border border-border/50 transition-all duration-300 ease-out hover:bg-accent/20 hover:shadow-sm">
                <div className="p-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className="w-4 h-4 text-muted-foreground" />
                      <h3 className="font-medium text-foreground">
                        {column.name}
                      </h3>
                      <span className="text-sm text-muted-foreground">
                        {column.tasks.length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-2 overflow-y-auto overflow-x-hidden flex-1 min-h-0 [-webkit-overflow-scrolling:touch]">
                  <div className="flex flex-col gap-1.5">
                    {column.tasks.map((task) => (
                      <PublicTaskCard
                        key={task.id}
                        task={task}
                        projectSlug={project.slug}
                        onTaskClick={onTaskClick}
                      />
                    ))}
                  </div>

                  {column.tasks.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-12 px-4">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      No tasks in {column.name.toLowerCase()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
