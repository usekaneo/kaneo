import useBoardWebsocket from "@/hooks/use-board-websocket";
import useProjectStore from "@/store/project";
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
import { produce } from "immer";
import { useState } from "react";
import Column from "./column";
import TaskCard from "./task-card";

function KanbanBoard() {
  const { project, setProject } = useProjectStore();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const { ws } = useBoardWebsocket();
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
        const destinationIndex = destinationColumn.tasks.findIndex(
          (t) => t.id === overId,
        );
        destinationColumn.tasks.splice(destinationIndex, 0, task);
      } else {
        const updatedTask = { ...task, status: destinationColumn.id };
        ws?.send(JSON.stringify({ type: "UPDATE_TASK", ...updatedTask }));

        const destinationIndex =
          overId === destinationColumn.id
            ? destinationColumn.tasks.length
            : destinationColumn.tasks.findIndex((t) => t.id === overId);

        destinationColumn.tasks.splice(destinationIndex, 0, updatedTask);
      }
    });

    setProject(updatedProject);
    setActiveId(null);
  };

  if (!project || !project.columns) {
    return (
      <div className="h-full flex flex-col">
        <header className="mb-6 space-y-6 shrink-0 px-6">
          <div className="flex items-center justify-between">
            <div className="w-48 h-8 bg-zinc-100 dark:bg-zinc-800/50 rounded-md animate-pulse" />
          </div>
        </header>

        <div className="flex-1 relative min-h-0">
          <div className="flex gap-6 overflow-x-auto pb-4 px-4 md:px-6 h-full">
            {[...Array(3)].map((_, i) => (
              <div
                key={`kanban-column-skeleton-${
                  // biome-ignore lint/suspicious/noArrayIndexKey: It's a skeleton
                  i
                }`}
                className="flex-1 min-w-80 flex flex-col bg-zinc-50 dark:bg-zinc-900 rounded-lg h-full"
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
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <div className="flex flex-col flex-1">
        <header className="mt-6 ml-6 mr-6 space-y-6 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {project?.name}
            </h1>
          </div>
        </header>

        <div className="flex-1 relative min-h-0 p-6">
          <div className="flex gap-6 overflow-x-auto h-full snap-x snap-mandatory">
            {project?.columns.map((column) => (
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
