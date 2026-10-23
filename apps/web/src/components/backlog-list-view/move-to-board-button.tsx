import { produce } from "immer";
import { SquareKanbanIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import type Task from "@/types/task";
import { boardEntryColumn } from "./board-entry-column";

// Sends one planned task to the board's entry column without opening menus.
export function MoveToBoardButton({ task }: { task: Task }) {
  const { t } = useTranslation();
  const { mutateAsync: updateTaskStatus } = useUpdateTaskStatus();
  const column = useProjectStore((state) =>
    boardEntryColumn(state.project?.columns),
  );

  if (task.status !== "planned" || !column) return null;

  const label = t("tasks:backlog.moveToColumn", { column: column.name });

  const move = async () => {
    const { project, setProject } = useProjectStore.getState();
    if (!project) return;
    // Leave the backlog at once; the board refetch settles the position.
    setProject(
      produce(project, (draft) => {
        draft.plannedTasks = (draft.plannedTasks ?? []).filter(
          (planned) => planned.id !== task.id,
        );
        draft.columns
          ?.find((candidate) => candidate.slug === column.slug)
          ?.tasks.push({ ...task, status: column.slug });
      }),
    );
    try {
      await updateTaskStatus({ ...task, status: column.slug });
      toast.success(t("tasks:backlog.movedToColumn", { column: column.name }), {
        icon: SquareKanbanIcon,
      });
    } catch {
      const current = useProjectStore.getState().project;
      if (current?.id === project.id) setProject(project);
      toast.error(t("tasks:backlog.moveToColumnError"));
    }
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // The row is draggable and opens the task on click.
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        void move();
      }}
      className={cn(
        "flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-muted-foreground text-xs outline-none transition-[opacity,color,background-color] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        "md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
      )}
    >
      <SquareKanbanIcon className="size-3.5" aria-hidden="true" />
      <span className="max-sm:sr-only">{column.name}</span>
    </button>
  );
}
