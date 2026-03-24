import { produce } from "immer";
import { Archive } from "lucide-react";
import { useState } from "react";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { getColumnIcon } from "@/lib/column";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import { ArchiveTasksModal } from "../../shared/modals/archive-tasks-modal";

type ColumnHeaderProps = {
  column: ProjectWithTasks["columns"][number];
};

export function ColumnHeader({ column }: ColumnHeaderProps) {
  const { project, setProject } = useProjectStore();
  const { mutate: updateTask } = useUpdateTask();

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);

  const handleConfirmArchive = () => {
    if (!column.isFinal || !project) return;

    const updatedProject = produce(project, (draft) => {
      const archivedColumn = draft?.columns?.find(
        (col) => col.id === column.id,
      );
      if (!archivedColumn) return;

      for (const task of archivedColumn.tasks) {
        updateTask({
          ...task,
          status: "archived",
        });
      }

      archivedColumn.tasks = [];
    });

    setProject(updatedProject);
    toast.success(`Archived ${column.tasks.length} tasks`);
    setIsArchiveModalOpen(false);
  };

  return (
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

      {column.isFinal && column.tasks.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setIsArchiveModalOpen(true)}
            className="flex items-center rounded-md px-2 py-1 text-left text-muted-foreground transition-all hover:bg-accent/50"
            title="Archive all completed tasks"
          >
            <Archive className="w-4 h-4 text-muted-foreground" />
          </button>

          <ArchiveTasksModal
            open={isArchiveModalOpen}
            onClose={() => setIsArchiveModalOpen(false)}
            onConfirm={handleConfirmArchive}
            taskCount={column.tasks.length}
          />
        </>
      )}
    </div>
  );
}
