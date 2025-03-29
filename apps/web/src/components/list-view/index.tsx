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
import { Archive, ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import CreateTaskModal from "../shared/modals/create-task-modal";
import TaskRow from "./task-row";
import TaskRowOverlay from "./task-row-overlay";

type ListViewProps = {
  project: ProjectWithTasks;
};

function ListView({ project }: ListViewProps) {
  const { setProject } = useProjectStore();
  const { mutate: updateTask } = useUpdateTask();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const [activeTask, setActiveTask] = useState<Task | null>(null);
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

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = project?.columns
      ?.flatMap((col) => col.tasks)
      .find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !project?.columns) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    const updatedProject = produce(project, (draft) => {
      const sourceColumn = draft.columns?.find((col) =>
        col.tasks.some((task) => task.id === activeId),
      );
      const destinationColumn = draft.columns?.find(
        (col) =>
          col.id === overId || col.tasks.some((task) => task.id === overId),
      );

      if (!sourceColumn || !destinationColumn) return;

      const taskIndex = sourceColumn.tasks.findIndex((t) => t.id === activeId);
      const task = sourceColumn.tasks[taskIndex];

      sourceColumn.tasks.splice(taskIndex, 1);

      if (sourceColumn.id === destinationColumn.id) {
        const destinationIndex = destinationColumn.tasks.findIndex(
          (t) => t.id === overId,
        );
        destinationColumn.tasks.splice(destinationIndex, 0, task);
      } else {
        destinationColumn.tasks.push({
          ...task,
          status: destinationColumn.id,
        });
      }

      destinationColumn.tasks.forEach((t, index) => {
        updateTask({
          ...t,
          status: destinationColumn.id,
          position: index + 1,
        });
      });
    });

    setProject(updatedProject);
    setActiveTask(null);
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
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
      <div key={column.id} className="space-y-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => toggleSection(column.id)}
            className={cn(
              "flex-1 flex items-center gap-2 p-2 text-left rounded-lg",
              "hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors",
              "group",
            )}
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 text-zinc-500 dark:text-zinc-400 transition-transform",
                !expandedSections[column.id] && "-rotate-90",
              )}
            />
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {column.name}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {column.tasks.length}
            </span>
          </button>

          {column.id === "done" && column.tasks.length > 0 && (
            <button
              type="button"
              onClick={handleArchiveTasks}
              className="p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50 rounded-md flex items-center transition-all"
              title="Archive all completed tasks"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}
        </div>

        {expandedSections[column.id] && (
          <div ref={setNodeRef} className="min-h-[60px] rounded-lg">
            <SortableContext
              items={column.tasks}
              strategy={verticalListSortingStrategy}
            >
              <motion.div
                initial={false}
                animate={{ opacity: 1 }}
                className="space-y-1"
              >
                {column.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    projectSlug={project?.slug ?? ""}
                  />
                ))}

                {column.tasks.length === 0 && (
                  <div className="px-10 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg min-h-[60px] flex items-center justify-center">
                    No tasks in {column.name.toLowerCase()}
                  </div>
                )}
              </motion.div>
            </SortableContext>

            <button
              type="button"
              onClick={() => {
                setIsTaskModalOpen(true);
                setActiveColumn(column.id);
              }}
              className="w-full mt-2 text-left px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50 rounded-md flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <span>Add task</span>
            </button>
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
        {project.columns.map((column) => (
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
        status={toKebabCase(activeColumn ?? "done")}
      />
    </DndContext>
  );
}

export default ListView;
