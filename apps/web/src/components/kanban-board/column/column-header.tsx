import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import { getColumnIcon, getColumnIconColor } from "@/lib/column";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import { produce } from "immer";
import { Archive } from "lucide-react";
import { toast } from "sonner";

interface ColumnHeaderProps {
  column: ProjectWithTasks["columns"][number];
}

export function ColumnHeader({ column }: ColumnHeaderProps) {
  const { project, setProject } = useProjectStore();
  const { mutate: updateTask } = useUpdateTask();

  const handleArchiveTasks = () => {
    if (column.id !== "done") return;

    if (column.tasks.length === 0) {
      toast.info("No tasks to archive");
      return;
    }

    if (!confirm(`Archive all ${column.tasks.length} completed tasks?`)) {
      return;
    }

    const updatedProject = produce(project, (draft) => {
      const doneColumn = draft?.columns?.find((col) => col.id === "done");
      if (!doneColumn) return;

      for (const task of doneColumn.tasks) {
        updateTask({
          ...task,
          status: "archived",
        });
      }

      doneColumn.tasks = [];
    });

    setProject(updatedProject);
    toast.success(`Archived ${column.tasks.length} tasks`);
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {(() => {
          const IconComponent = getColumnIcon(column.id);
          return (
            <IconComponent
              className={`w-4 h-4 ${getColumnIconColor(column.id)}`}
            />
          );
        })()}
        <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
          {column.name}
        </h3>
        <span className="text-sm text-zinc-500 dark:text-zinc-500">
          {column.tasks.length}
        </span>
      </div>

      {column.id === "done" && column.tasks.length > 0 && (
        <button
          type="button"
          onClick={handleArchiveTasks}
          className="text-left px-2 py-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50 rounded-md flex items-center transition-all group"
          title="Archive all completed tasks"
        >
          <Archive className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
        </button>
      )}
    </div>
  );
}
