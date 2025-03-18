import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import useProjectStore from "@/store/project";
import type { Project, Task } from "@/types/project";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { addWeeks, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import { produce } from "immer";
import { useState } from "react";
import BoardFilters, {
  type BoardFilters as BoardFiltersType,
} from "../filters";
import Column from "./column";
import TaskCard from "./task-card";

function KanbanBoard({ project }: { project: Project | undefined }) {
  const { setProject } = useProjectStore();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const { mutate: updateTask } = useUpdateTask();
  const [filters, setFilters] = useState<BoardFiltersType>({
    search: "",
    assignee: null,
    priority: null,
    dueDate: null,
  });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !project?.columns) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    const updatedProject = produce(project, (draft) => {
      const sourceColumn = draft?.columns?.find((col) =>
        col.tasks.some((task) => task.id === activeId),
      );
      const destinationColumn = draft?.columns?.find(
        (col) =>
          col.id === overId || col.tasks.some((task) => task.id === overId),
      );

      if (!sourceColumn || !destinationColumn) return;

      const sourceTaskIndex = sourceColumn.tasks.findIndex(
        (task) => task.id === activeId,
      );
      const task = sourceColumn.tasks[sourceTaskIndex];

      sourceColumn.tasks = sourceColumn.tasks.filter((t) => t.id !== activeId);

      if (sourceColumn.id === destinationColumn.id) {
        let destinationIndex = destinationColumn.tasks.findIndex(
          (t) => t.id === overId,
        );
        if (sourceTaskIndex <= destinationIndex) {
          destinationIndex += 1;
        }
        destinationColumn.tasks.splice(destinationIndex, 0, task);

        destinationColumn.tasks.forEach((t, index) => {
          updateTask({ ...t, position: index + 1 });
        });
      } else {
        const updatedTask = { ...task, status: destinationColumn.id };
        const destinationIndex =
          overId === destinationColumn.id
            ? destinationColumn.tasks.length
            : destinationColumn.tasks.findIndex((t) => t.id === overId);

        destinationColumn.tasks.splice(destinationIndex + 1, 0, updatedTask);

        destinationColumn.tasks.forEach((t, index) => {
          updateTask({ ...t, position: index + 1 });
        });
      }
    });

    setProject(updatedProject);
    setActiveId(null);
  };

  const filterTasks = (tasks: Task[]): Task[] => {
    return tasks.filter((task) => {
      if (
        filters.search &&
        !task.title.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }

      if (filters.assignee && task.userEmail !== filters.assignee) {
        return false;
      }

      if (filters.priority && task.priority !== filters.priority) {
        return false;
      }

      if (filters.dueDate && task.dueDate) {
        const today = new Date();
        const taskDate = new Date(task.dueDate);

        switch (filters.dueDate) {
          case "Due this week": {
            const weekStart = startOfWeek(today);
            const weekEnd = endOfWeek(today);
            if (
              !isWithinInterval(taskDate, { start: weekStart, end: weekEnd })
            ) {
              return false;
            }
            break;
          }
          case "Due next week": {
            const nextWeekStart = startOfWeek(addWeeks(today, 1));
            const nextWeekEnd = endOfWeek(addWeeks(today, 1));
            if (
              !isWithinInterval(taskDate, {
                start: nextWeekStart,
                end: nextWeekEnd,
              })
            ) {
              return false;
            }
            break;
          }
          case "No due date": {
            return false;
          }
        }
      }

      return true;
    });
  };

  const filteredColumns = project?.columns?.map((column) => ({
    ...column,
    tasks: filterTasks(column.tasks),
  }));

  if (!project || !project?.columns) {
    return (
      <div className="h-full flex flex-col w-full">
        <header className="mb-6 mt-6 space-y-6 shrink-0 px-6">
          <div className="flex items-center justify-between">
            <div className="w-48 h-8 bg-zinc-100 dark:bg-zinc-800/50 rounded-md animate-pulse" />
          </div>
        </header>

        <div className="flex-1 relative min-h-0">
          <div className="flex gap-6 flex-1 overflow-x-auto pb-4 px-4 md:px-6 h-full">
            {[...Array(4)].map((_, i) => (
              <div
                key={`kanban-column-skeleton-${
                  // biome-ignore lint/suspicious/noArrayIndexKey: It's a skeleton
                  i
                }`}
                className="flex-1 w-full min-w-80 flex flex-col bg-zinc-50 dark:bg-zinc-900 rounded-lg h-full"
              >
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="w-24 h-5 bg-zinc-100 dark:bg-zinc-800/50 rounded animate-pulse" />
                  <div className="w-8 h-5 bg-zinc-100 dark:bg-zinc-800/50 rounded animate-pulse" />
                </div>

                <div className="px-2 pb-4 flex flex-col gap-3 flex-1">
                  {[...Array(3)].map((_, j) => (
                    <div
                      key={`kanban-task-skeleton-${
                        // biome-ignore lint/suspicious/noArrayIndexKey: It's a skeleton
                        j
                      }`}
                      className="p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800/50 animate-pulse"
                    >
                      <div className="space-y-3">
                        <div className="w-2/3 h-4 bg-zinc-200 dark:bg-zinc-700/50 rounded" />
                        <div className="w-1/2 h-3 bg-zinc-200 dark:bg-zinc-700/50 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeTask = activeId
    ? project.columns
        .flatMap((col) => col.tasks)
        .find((task) => task.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col overflow-hidden w-full">
        <header className="sticky top-0 z-10 bg-white/30 dark:bg-zinc-900/30 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800">
          <div className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h1 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {project.name}
              </h1>
              <BoardFilters onFiltersChange={setFilters} />
            </div>
          </div>
        </header>

        <div className="flex-1 h-full overflow-auto">
          <div className="flex gap-6 p-6 min-h-full">
            {filteredColumns?.map((column) => (
              <Column key={column.id} column={column} />
            ))}
          </div>
        </div>
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="transform rotate-3">
            <TaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default KanbanBoard;
