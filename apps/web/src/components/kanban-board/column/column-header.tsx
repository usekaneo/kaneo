import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import useProjectStore from "@/store/project";
import type { Column } from "@/types/project";
import { produce } from "immer";
import { Archive } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface ColumnHeaderProps {
  column: Column;
}

export function ColumnHeader({ column }: ColumnHeaderProps) {
  const { project, setProject } = useProjectStore();
  const { mutate: updateTask } = useUpdateTask();
  const { t } = useTranslation();

  const handleArchiveTasks = () => {
    if (column.id !== "done") return;

    if (column.tasks.length === 0) {
      toast.info(
        t("column_header.no_tasks_to_archive", {
          defaultValue: "No tasks to archive",
        }),
      );
      return;
    }

    if (
      !confirm(
        t("column_header.archive_confirm", {
          defaultValue: "Archive all {{count}} completed tasks?",
          count: column.tasks.length,
        }),
      )
    ) {
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
    toast.success(
      t("column_header.archived_tasks", {
        defaultValue: "Archived {{count}} tasks",
        count: column.tasks.length,
      }),
    );
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
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
          title={t("column_header.archive_all_completed", {
            defaultValue: "Archive all completed tasks",
          })}
        >
          <Archive className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
        </button>
      )}
    </div>
  );
}
