import { priorityColorsTaskCard } from "@/constants/priority-colors";
import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import { cn } from "@/lib/cn";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Popover from "@radix-ui/react-popover";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { produce } from "immer";
import {
  Flag,
  GripVertical,
  MoreHorizontal,
  MoveRight,
  User as UserIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface BacklogTaskRowProps {
  task: Task;
}

export default function BacklogTaskRow({ task }: BacklogTaskRowProps) {
  const navigate = useNavigate();
  const { project, setProject } = useProjectStore();
  const { mutate: updateTask } = useUpdateTask();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "task",
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleMoveToColumn = (columnId: string) => {
    if (!project) return;

    updateTask({
      ...task,
      status: columnId,
    });

    const updatedProject = produce(project, (draft: ProjectWithTasks) => {
      if (draft.archivedTasks) {
        const index = draft.archivedTasks.findIndex(
          (t: Task) => t.id === task.id,
        );
        if (index !== -1) {
          draft.archivedTasks.splice(index, 1);
        }
      }

      if (draft.plannedTasks) {
        const index = draft.plannedTasks.findIndex(
          (t: Task) => t.id === task.id,
        );
        if (index !== -1) {
          draft.plannedTasks.splice(index, 1);
        }
      }

      const targetColumn = draft.columns?.find(
        (col: ProjectWithTasks["columns"][number]) => col.id === columnId,
      );
      if (targetColumn) {
        targetColumn.tasks.push({
          ...task,
          status: columnId,
          assigneeName: task.userEmail,
          assigneeEmail: task.userEmail,
        });
      }
    });

    setProject(updatedProject);
    toast.success(`Task moved to ${columnId.replace(/-/g, " ")}`);
    setIsMenuOpen(false);
  };

  const handleClick = () => {
    if (!project || !task) return;

    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: {
        workspaceId: project.workspaceId,
        projectId: project.id,
        taskId: task.id,
      },
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "flex items-center gap-2 p-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm",
        isDragging && "opacity-50",
      )}
    >
      <div
        {...listeners}
        className="cursor-grab p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={handleClick}
          className="w-full text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {task.title}
            </span>
            <span className="text-xs px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded">
              {task.status === "archived" ? "Archived" : "Planned"}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {task.priority && (
              <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <Flag
                  className="w-3 h-3"
                  style={{
                    color:
                      priorityColorsTaskCard[
                        task.priority as keyof typeof priorityColorsTaskCard
                      ],
                  }}
                />
                <span className="capitalize">{task.priority}</span>
              </div>
            )}
            {task.userEmail && (
              <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <UserIcon className="w-3 h-3" />
                <span>{task.userEmail}</span>
              </div>
            )}
            {task.dueDate && (
              <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <UserIcon className="w-3 h-3" />
                <span>{format(new Date(task.dueDate), "MMM d")}</span>
              </div>
            )}
          </div>
        </button>
      </div>

      <Popover.Root open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(true);
            }}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </Popover.Trigger>
        <Popover.Content
          className="bg-white dark:bg-zinc-900 rounded-md shadow-md border border-zinc-200 dark:border-zinc-700 p-1 z-50"
          align="end"
          sideOffset={5}
        >
          <div className="bg-zinc-50 dark:bg-zinc-900 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Move to column
            </div>
          </div>
          <div className="p-1 max-h-60 overflow-y-auto">
            {project?.columns?.map(
              (column: ProjectWithTasks["columns"][number]) => (
                <button
                  key={column.id}
                  type="button"
                  className="w-full text-left px-2 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md flex items-center gap-2 transition-colors"
                  onClick={() => handleMoveToColumn(column.id)}
                >
                  <MoveRight className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span>{column.name}</span>
                </button>
              ),
            )}
          </div>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}
