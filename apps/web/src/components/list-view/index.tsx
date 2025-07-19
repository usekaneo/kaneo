import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import { cn } from "@/lib/cn";
import toKebabCase from "@/lib/to-kebab-case";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { produce } from "immer";
import { Archive, ChevronRight, Flag, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import CreateTaskModal from "../shared/modals/create-task-modal";
import TaskRow from "./task-row";

type ListViewProps = {
  project: ProjectWithTasks;
};

function ListView({ project }: ListViewProps) {
  const { setProject } = useProjectStore();
  const { mutate: updateTask } = useUpdateTask();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    "to-do": true,
    "in-progress": true,
    "in-review": true,
    done: true,
  });
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over || !activeId) {
      setOverColumnId(null);
      return;
    }

    // Check if we're over a column directly
    if (project?.columns?.some((col) => col.id === over.id)) {
      setOverColumnId(over.id.toString());
      return;
    }

    // Check if we're over a task - find which column it belongs to
    const taskId = over.id.toString();
    const columnWithTask = project?.columns?.find((col) =>
      col.tasks.some((task) => task.id === taskId),
    );

    if (columnWithTask) {
      setOverColumnId(columnWithTask.id);
    } else {
      setOverColumnId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverColumnId(null);

    if (!over || !project?.columns) return;

    const activeTaskId = active.id.toString();
    const overId = over.id.toString();

    const updatedProject = produce(project, (draft) => {
      const sourceColumn = draft?.columns?.find((col) =>
        col.tasks.some((task) => task.id === activeTaskId),
      );
      const destinationColumn = draft?.columns?.find(
        (col) =>
          col.id === overId || col.tasks.some((task) => task.id === overId),
      );

      if (!sourceColumn || !destinationColumn) return;

      const sourceTaskIndex = sourceColumn.tasks.findIndex(
        (task) => task.id === activeTaskId,
      );
      const task = sourceColumn.tasks[sourceTaskIndex];

      sourceColumn.tasks = sourceColumn.tasks.filter(
        (t) => t.id !== activeTaskId,
      );

      if (sourceColumn.id === destinationColumn.id) {
        let destinationIndex = destinationColumn.tasks.findIndex(
          (t) => t.id === overId,
        );
        if (sourceTaskIndex <= destinationIndex) {
          destinationIndex += 1;
        }
        destinationColumn.tasks.splice(destinationIndex, 0, task);

        destinationColumn.tasks.forEach((t, index) => {
          updateTask({
            ...t,
            status: destinationColumn.id,
            position: index + 1,
          });
        });
      } else {
        task.status = destinationColumn.id;
        destinationColumn.tasks.push(task);

        destinationColumn.tasks.forEach((t, index) => {
          updateTask({
            ...t,
            status: destinationColumn.id,
            position: index + 1,
          });
        });
      }
    });

    setProject(updatedProject);
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleArchiveTasks = (column: ProjectWithTasks["columns"][number]) => {
    if (column.id !== "done" || column.tasks.length === 0) return;

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

  function ColumnSection({
    column,
  }: { column: ProjectWithTasks["columns"][number] }) {
    const { setNodeRef } = useDroppable({
      id: column.id,
      data: {
        type: "column",
        column,
      },
    });

    const showDropIndicator = activeId && overColumnId === column.id;

    return (
      <div
        className={cn(
          "border-b border-zinc-200 dark:border-zinc-800/50 transition-all duration-200",
          showDropIndicator &&
            "border-l-4 border-l-indigo-500 dark:border-l-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/10",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between py-2 px-4 bg-zinc-100/60 dark:bg-zinc-800/20 border-b border-zinc-200/50 dark:border-zinc-800/30">
          <button
            type="button"
            onClick={() => toggleSection(column.id)}
            className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ChevronRight
              className={cn(
                "w-3 h-3 transition-transform",
                expandedSections[column.id] && "rotate-90",
              )}
            />
            <span>{column.name}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-500 ml-1 bg-zinc-200/50 dark:bg-zinc-700/50 px-1.5 py-0.5 rounded-full">
              {column.tasks.length}
            </span>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setIsTaskModalOpen(true);
                setActiveColumn(column.id);
              }}
              className="p-1 hover:bg-zinc-200/70 dark:hover:bg-zinc-700 rounded text-zinc-600 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
              title="Add task"
            >
              <Plus className="w-3 h-3" />
            </button>

            {column.id === "done" && column.tasks.length > 0 && (
              <button
                type="button"
                onClick={() => handleArchiveTasks(column)}
                className="p-1 hover:bg-zinc-200/70 dark:hover:bg-zinc-700 rounded text-zinc-600 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                title="Archive all completed tasks"
              >
                <Archive className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Tasks */}
        {expandedSections[column.id] && (
          <div ref={setNodeRef} className="bg-white dark:bg-transparent">
            <SortableContext
              items={column.tasks}
              strategy={verticalListSortingStrategy}
            >
              {column.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  projectSlug={project?.slug ?? ""}
                />
              ))}
            </SortableContext>

            {column.tasks.length === 0 && (
              <div className="py-6 px-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
                No tasks
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!project?.columns) {
    return null;
  }

  // Get the active task being dragged
  const activeTask = activeId
    ? project.columns
        ?.flatMap((col) => col.tasks)
        .find((task) => task.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      modifiers={[snapCenterToCursor]}
    >
      <div className="w-full h-full overflow-hidden bg-zinc-50/30 dark:bg-transparent">
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
          {project.columns.map((column) => (
            <ColumnSection key={column.id} column={column} />
          ))}
        </div>
      </div>

      {/* Minimal Drag Overlay */}
      <DragOverlay>
        {activeTask && (
          <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-2 max-w-[200px] cursor-grabbing">
            <div className="flex items-center gap-2">
              {/* Priority Flag */}
              <div className="flex-shrink-0">
                <Flag
                  className={cn(
                    "w-3 h-3",
                    activeTask.priority === "high" && "text-red-500",
                    activeTask.priority === "medium" && "text-orange-500",
                    activeTask.priority === "low" && "text-green-500",
                    (!activeTask.priority || activeTask.priority === "none") &&
                      "text-zinc-300 dark:text-zinc-600",
                  )}
                />
              </div>

              {/* Task Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                    {project?.slug}-{activeTask.number}
                  </span>
                  <span className="text-xs text-zinc-900 dark:text-zinc-100 truncate">
                    {activeTask.title}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </DragOverlay>

      <CreateTaskModal
        open={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        status={toKebabCase(activeColumn ?? "done")}
      />
    </DndContext>
  );
}

export default ListView;
