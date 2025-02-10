import useBoardWebsocket from '@/hooks/use-board-websocket';
import useProjectStore from '@/store/project';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type UniqueIdentifier,
  closestCorners,
} from '@dnd-kit/core';
import { produce } from 'immer';
import { useState } from 'react';
import Column from './column';
import TaskCard from './task-card';

const KanbanBoard = () => {
  const { project, setProject } = useProjectStore();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const { ws } = useBoardWebsocket();

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
        ws?.send(JSON.stringify({ type: 'UPDATE_TASK', ...updatedTask }));

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

  if (!project || !project?.columns) return <>TODO: Empty state.</>;

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
    >
      <div className="h-full flex flex-col">
        <header className="mb-6 space-y-6 shrink-0 px-4 md:px-0">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {project?.name}
            </h1>
          </div>
        </header>
        <div className="flex-1 relative min-h-0">
          <div className="flex gap-6 overflow-x-auto pb-4 px-4 md:px-6 h-full snap-x snap-mandatory">
            {project?.columns.map((column) => (
              <Column
                key={column.id}
                column={column}
              />
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
};

export default KanbanBoard;
