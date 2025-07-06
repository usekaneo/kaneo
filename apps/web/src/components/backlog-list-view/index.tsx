import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import { cn } from "@/lib/cn";
import toKebabCase from "@/lib/to-kebab-case";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import { produce } from "immer";
import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import TaskRowOverlay from "../list-view/task-row-overlay";
import CreateTaskModal from "../shared/modals/create-task-modal";
import BacklogTaskRow from "./backlog-task-row";

interface BacklogListViewProps {
  project?: ProjectWithTasks;
}

function BacklogListView({ project }: BacklogListViewProps) {
  const { setProject } = useProjectStore();
  const { mutate: updateTask } = useUpdateTask();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    if (project?.columns) {
      const initialExpandedState: Record<string, boolean> = {};
      for (const column of project.columns) {
        initialExpandedState[column.id] = true;
      }
      setExpandedSections(initialExpandedState);
    }
  }, [project?.columns]);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === "task") {
      setActiveTask(event.active.data.current.task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !active.data.current || !project) return;

    if (
      active.data.current.type === "task" &&
      over.data.current?.type === "column"
    ) {
      const task = active.data.current.task as Task;
      const targetColumnId = over.data.current.column.id;

      if (task.status === targetColumnId) {
        setActiveTask(null);
        return;
      }

      updateTask({
        ...task,
        status: targetColumnId,
      });

      const updatedProject = produce(project, (draft: ProjectWithTasks) => {
        if (task.status === "planned" && targetColumnId === "archived") {
          if (draft.plannedTasks) {
            const index = draft.plannedTasks.findIndex(
              (t: Task) => t.id === task.id,
            );
            if (index !== -1) {
              const [removedTask] = draft.plannedTasks.splice(index, 1);
              if (draft.archivedTasks) {
                draft.archivedTasks.push({
                  ...removedTask,
                  status: "archived",
                });
              }
            }
          }
        } else if (task.status === "archived" && targetColumnId === "planned") {
          if (draft.archivedTasks) {
            const index = draft.archivedTasks.findIndex(
              (t: Task) => t.id === task.id,
            );
            if (index !== -1) {
              const [removedTask] = draft.archivedTasks.splice(index, 1);
              if (draft.plannedTasks) {
                draft.plannedTasks.push({
                  ...removedTask,
                  status: "planned",
                });
              }
            }
          }
        } else if (
          (task.status === "planned" || task.status === "archived") &&
          (targetColumnId === "to-do" ||
            targetColumnId === "in-progress" ||
            targetColumnId === "in-review" ||
            targetColumnId === "done")
        ) {
          if (task.status === "planned" && draft.plannedTasks) {
            const index = draft.plannedTasks.findIndex(
              (t: Task) => t.id === task.id,
            );
            if (index !== -1) {
              draft.plannedTasks.splice(index, 1);
            }
          } else if (task.status === "archived" && draft.archivedTasks) {
            const index = draft.archivedTasks.findIndex(
              (t: Task) => t.id === task.id,
            );
            if (index !== -1) {
              draft.archivedTasks.splice(index, 1);
            }
          }

          const targetColumn = draft.columns?.find(
            (col: ProjectWithTasks["columns"][number]) =>
              col.id === targetColumnId,
          );
          if (targetColumn) {
            targetColumn.tasks.push({
              ...task,
              status: targetColumnId,
              assigneeName: task.assigneeName,
              assigneeEmail: task.assigneeEmail,
            });
          }
        }
      });

      setProject(updatedProject);
      toast.success(`Task moved to ${toKebabCase(targetColumnId)}`);
    }

    setActiveTask(null);
  };

  const toggleSection = (columnId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [columnId]: !prev[columnId],
    }));
  };

  function ColumnSection({
    column,
  }: {
    column: ProjectWithTasks["columns"][number];
  }) {
    const { setNodeRef } = useDroppable({
      id: column.id,
      data: {
        type: "column",
        column,
      },
    });

    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(column.id)}
          className={cn(
            "w-full flex items-center justify-between p-3 text-left bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800",
            !expandedSections[column.id] && "border-b-0",
          )}
        >
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
              {column.name}
            </h3>
            <span className="text-sm text-zinc-500 dark:text-zinc-500">
              {column.tasks.length}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-zinc-500 dark:text-zinc-400 transition-transform",
              expandedSections[column.id] ? "transform rotate-180" : "",
            )}
          />
        </button>

        {expandedSections[column.id] && (
          <div ref={setNodeRef} className="min-h-[60px] rounded-lg">
            <SortableContext
              items={column.tasks}
              strategy={verticalListSortingStrategy}
            >
              <motion.div
                initial={false}
                animate={{ opacity: 1 }}
                className="space-y-1 p-2"
              >
                {column.tasks.length > 0 ? (
                  column.tasks.map((task: Task) => (
                    <BacklogTaskRow key={task.id} task={task} />
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    {/* @ts-expect-error */}
                    No {column.id === "planned" ? "planned" : "archived"} tasks
                  </div>
                )}
              </motion.div>
            </SortableContext>

            {/* @ts-expect-error */}
            {column.id === "planned" && (
              <button
                type="button"
                onClick={() => {
                  setIsTaskModalOpen(true);
                  setActiveColumn("planned");
                }}
                className="w-full mt-2 text-left px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50 rounded-md flex items-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <span>Add planned task</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!project?.columns) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full h-full p-4 space-y-4">
        {project.columns.map((column: ProjectWithTasks["columns"][number]) => (
          <ColumnSection key={column.id} column={column} />
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <TaskRowOverlay task={activeTask} projectSlug={project?.slug ?? ""} />
        )}
      </DragOverlay>
      <CreateTaskModal
        open={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        status={toKebabCase(activeColumn ?? "planned")}
      />
    </DndContext>
  );
}

export default BacklogListView;
