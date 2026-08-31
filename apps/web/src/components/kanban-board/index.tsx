import {
  type CollisionDetection,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useNavigate } from "@tanstack/react-router";
import { produce } from "immer";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useReorderTasks } from "@/hooks/mutations/task/use-reorder-tasks";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import collectReorderedTasks from "@/lib/collect-reordered-tasks";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import BulkToolbar from "../bulk-selection/bulk-toolbar";
import Column from "./column";
import TaskCard from "./task-card";

type KanbanBoardProps = {
  project: ProjectWithTasks;
  disableDragDrop?: boolean;
};

function KanbanBoard({ project, disableDragDrop = false }: KanbanBoardProps) {
  const setProject = useProjectStore((s) => s.setProject);
  const setAvailableTasks = useBulkSelectionStore((s) => s.setAvailableTasks);
  const focusNext = useBulkSelectionStore((s) => s.focusNext);
  const focusPrevious = useBulkSelectionStore((s) => s.focusPrevious);
  const clearFocus = useBulkSelectionStore((s) => s.clearFocus);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const { mutate: reorderTasks } = useReorderTasks();
  const navigate = useNavigate();

  useEffect(() => {
    if (project?.columns) {
      const allTaskIds = project.columns.flatMap((column) =>
        column.tasks.map((task) => task.id),
      );
      setAvailableTasks(allTaskIds);
    }
  }, [project, setAvailableTasks]);

  useEffect(() => {
    clearFocus();
  }, [clearFocus]);

  useRegisterShortcuts({
    shortcuts: {
      j: () => {
        focusNext();
        const state = useBulkSelectionStore.getState();
        if (state.focusedTaskId) {
          navigate({ to: ".", search: { taskId: state.focusedTaskId } });
        }
      },
      k: () => {
        focusPrevious();
        const state = useBulkSelectionStore.getState();
        if (state.focusedTaskId) {
          navigate({ to: ".", search: { taskId: state.focusedTaskId } });
        }
      },
      Enter: () => {
        const { focusedTaskId } = useBulkSelectionStore.getState();
        if (focusedTaskId && project) {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
            params: {
              workspaceId: project.workspaceId,
              projectId: project.id,
              taskId: focusedTaskId,
            },
          });
        }
      },
    },
  });

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: disableDragDrop ? 999999 : 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: disableDragDrop ? 999999 : 250,
        tolerance: 10,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.8",
        },
      },
    }),
    duration: 300,
    easing: "cubic-bezier(0.23, 1, 0.32, 1)",
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const taskIds = useMemo(
    () =>
      new Set(
        project.columns.flatMap((column) =>
          column.tasks.map((task) => task.id),
        ),
      ),
    [project.columns],
  );

  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const pointerCollisions = pointerWithin(args);

      if (pointerCollisions.length > 0) {
        // Prefer the precise card target when the pointer is on a rendered
        // card. Otherwise keep the column target, including an empty column.
        const taskCollision = pointerCollisions.find((collision) =>
          taskIds.has(collision.id.toString()),
        );
        return taskCollision ? [taskCollision] : pointerCollisions;
      }

      return closestCorners(args);
    },
    [taskIds],
  );

  const handleDragOver = ({ over }: DragOverEvent) => {
    if (!over) {
      setOverColumnId(null);
      return;
    }

    const overId = over.id.toString();
    const column = project.columns.find(
      (candidate) =>
        candidate.id === overId ||
        candidate.tasks.some((task) => task.id === overId),
    );

    setOverColumnId(column?.id ?? null);
  };

  const clearDragState = () => {
    setActiveId(null);
    setOverColumnId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    clearDragState();

    if (!over || !project?.columns) return;

    const draggedTaskId = active.id.toString();
    const overId = over.id.toString();

    let crossedColumns = false;

    const updatedProject = produce(project, (draft) => {
      const sourceColumn = draft?.columns?.find((col) =>
        col.tasks.some((task) => task.id === draggedTaskId),
      );
      const destinationColumn = draft?.columns?.find(
        (col) =>
          col.id === overId || col.tasks.some((task) => task.id === overId),
      );

      if (!sourceColumn || !destinationColumn) return;

      const sourceTaskIndex = sourceColumn.tasks.findIndex(
        (task) => task.id === draggedTaskId,
      );
      const task = sourceColumn.tasks[sourceTaskIndex];

      if (!task) return;

      sourceColumn.tasks.splice(sourceTaskIndex, 1);

      const overIndex = destinationColumn.tasks.findIndex(
        (t) => t.id === overId,
      );

      if (sourceColumn.id === destinationColumn.id) {
        let destinationIndex =
          overIndex === -1 ? destinationColumn.tasks.length : overIndex;

        if (overIndex !== -1 && sourceTaskIndex <= destinationIndex) {
          destinationIndex += 1;
        }

        destinationColumn.tasks.splice(destinationIndex, 0, task);
      } else {
        crossedColumns = true;
        // A task's status is a column slug. The column id is only the
        // droppable identity here, and the two are interchangeable only
        // because the tasks endpoint happens to return `id: column.slug`.
        task.status = destinationColumn.slug;

        const destinationIndex =
          overIndex === -1 ? destinationColumn.tasks.length : overIndex + 1;

        destinationColumn.tasks.splice(destinationIndex, 0, task);
      }

      // Renumber the columns the drag touched so stored positions stay dense.
      // A Set because a same-column move sees the same draft object twice.
      for (const column of new Set([sourceColumn, destinationColumn])) {
        column.tasks.forEach((t, index) => {
          t.position = index;
        });
      }
    });

    setProject(updatedProject);

    // One request for the whole drop. Sending a full task update per renumbered
    // neighbour is what used to flood the API on every move.
    const changedTasks = collectReorderedTasks(
      project.columns.flatMap((column) => column.tasks),
      updatedProject.columns.flatMap((column) => column.tasks),
    );

    if (changedTasks.length === 0) return;

    reorderTasks({
      projectId: project.id,
      tasks: changedTasks,
      crossedColumns,
    });
  };

  if (!project?.columns) {
    return (
      <div className="flex h-full w-full flex-col bg-linear-to-b from-muted/25 to-background">
        <header className="mb-6 mt-6 space-y-6 shrink-0 px-6">
          <div className="flex items-center justify-between">
            <div className="w-48 h-8 bg-muted/50 rounded-md animate-pulse" />
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <div className="flex h-full flex-1 gap-4 overflow-x-auto px-4 pb-4 md:px-5">
            {[...Array(4)].map((_, i) => (
              <div
                key={`kanban-column-skeleton-${
                  // biome-ignore lint/suspicious/noArrayIndexKey: It's a skeleton
                  i
                }`}
                className="h-full min-w-80 w-full flex-1 rounded-xl border border-border/70 bg-card"
              >
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="w-24 h-5 bg-muted/50 rounded animate-pulse" />
                  <div className="w-8 h-5 bg-muted/50 rounded animate-pulse" />
                </div>

                <div className="px-2 pb-4 flex flex-col gap-3 flex-1">
                  {[...Array(3)].map((_, j) => (
                    <div
                      key={`kanban-task-skeleton-${
                        // biome-ignore lint/suspicious/noArrayIndexKey: It's a skeleton
                        j
                      }`}
                      className="p-4 bg-card rounded-lg border border-border/50 animate-pulse"
                    >
                      <div className="space-y-3">
                        <div className="w-2/3 h-4 bg-muted/70 rounded" />
                        <div className="w-1/2 h-3 bg-muted/70 rounded" />
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
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={clearDragState}
    >
      <div className="flex h-full w-full flex-col bg-linear-to-b from-muted/20 to-background">
        <div className="min-h-0 flex-1 overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <div className="flex h-full min-w-max gap-4 px-4 py-4 md:px-5">
            {project.columns?.map((column) => (
              <div
                key={column.id}
                className="h-full max-w-96 min-w-80 shrink-0 flex-1"
              >
                <Column
                  column={column}
                  disableDragDrop={disableDragDrop}
                  isOver={overColumnId === column.id}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? (
          <div className="transform rotate-1 scale-[1.03] shadow-lg">
            <div className="ring-2 ring-ring/35 rounded-lg">
              <TaskCard task={activeTask} dragOverlay />
            </div>
          </div>
        ) : null}
      </DragOverlay>

      <BulkToolbar />
    </DndContext>
  );
}

export default KanbanBoard;
