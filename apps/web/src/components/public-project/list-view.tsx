import { getColumnIcon } from "@/lib/column";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { PublicTaskRow } from "./task-row";

type PublicListViewProps = {
  project: ProjectWithTasks;
  onTaskClick: (task: Task) => void;
};

export function PublicListView({ project, onTaskClick }: PublicListViewProps) {
  const columns = project.columns ?? [];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-6 space-y-8 max-w-5xl mx-auto">
        {columns.map((column) => {
          return (
            <div key={column.id} className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <span className="flex [&_svg]:!h-5 [&_svg]:!w-5">
                  {getColumnIcon(column.id, column.isFinal)}
                </span>
                <h3 className="font-semibold text-lg text-foreground">
                  {column.name}
                </h3>
                <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full font-medium">
                  {column.tasks.length}
                </span>
              </div>

              <div className="space-y-2">
                {column.tasks.map((task) => (
                  <PublicTaskRow
                    key={task.id}
                    task={task}
                    projectSlug={project.slug}
                    onTaskClick={onTaskClick}
                  />
                ))}

                {column.tasks.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8 bg-muted/50 rounded-lg border border-dashed border-border">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                      {getColumnIcon(column.id, column.isFinal)}
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
