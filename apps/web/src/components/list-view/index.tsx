import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import { cn } from "@/lib/cn";
import useProjectStore from "@/store/project";
import type { Column, Project, Task } from "@/types/project";
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
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import TaskRow from "./task-row";
import TaskRowOverlay from "./task-row-overlay";

interface ListViewProps {
  project: Project | undefined;
}

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

  function ColumnSection({ column }: { column: Column }) {
    const { setNodeRef } = useDroppable({
      id: column.id,
      data: {
        type: "column",
        column,
      },
    });

    return (
      <div key={column.id} className="space-y-2">
        <button
          type="button"
          onClick={() => toggleSection(column.id)}
          className={cn(
            "w-full flex items-center justify-between p-2 text-left rounded-lg",
            "hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors",
            "group",
          )}
        >
          <div className="flex items-center gap-2">
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
          </div>
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
                  <div className="px-10 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg min-h-[60px] flex items-center justify-center">
                    No tasks in {column.name.toLowerCase()}
                  </div>
                )}
              </motion.div>
            </SortableContext>
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
    </DndContext>
  );
}

export default ListView;
