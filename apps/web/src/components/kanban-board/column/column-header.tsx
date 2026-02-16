import { produce } from "immer";
import { Archive } from "lucide-react";
import { toast } from "@/lib/toast";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { getColumnIcon } from "@/lib/column";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";

type ColumnHeaderProps = {
  column: ProjectWithTasks["columns"][number];
};

export function ColumnHeader({ column }: ColumnHeaderProps) {
  const { project, setProject } = useProjectStore();
  const { mutate: updateTask } = useUpdateTask();

  const handleArchiveTasks = () => {
    if (!column.isFinal) return;

    if (column.tasks.length === 0) {
      toast.info("No tasks to archive");
      return;
    }

    if (!confirm(`Archive all ${column.tasks.length} completed tasks?`)) {
      return;
    }

    const updatedProject = produce(project, (draft) => {
      const doneColumn = draft?.columns?.find((col) => col.isFinal);
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
        {getColumnIcon(column.id, column.isFinal)}
        <span className="text-[15px] font-medium text-foreground/95">
          {column.name}
        </span>
        <span className="text-[15px] font-normal text-muted-foreground">
          {column.tasks.length}
        </span>
      </div>

      {column.isFinal && column.tasks.length > 0 && (
        <button
          type="button"
          onClick={handleArchiveTasks}
          className="text-left px-2 py-1.5 text-muted-foreground hover:bg-accent/50 rounded-md flex items-center transition-all group"
          title="Archive all completed tasks"
        >
          <Archive className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
