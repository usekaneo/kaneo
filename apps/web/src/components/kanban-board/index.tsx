import { invalidateMyWork } from "@/lib/invalidate-my-work";
import { markBoardCacheChanged } from "@/lib/board-cache-version";
import { selectReorderBoard } from "./select-reorder-board";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import reorderTasks, { type TaskReorder } from "@/fetchers/task/reorder-tasks";
import { toast } from "@/lib/toast";
import { useTranslation } from "react-i18next";
import { rollbackBoardReorder } from "./apply-reorder";
import { boardCollisionDetection } from "./board-collision-detection";
import { findTaskColumn } from "./drag-preview/find-task-column";
import { moveBoardTask } from "./move-task";
import { useDragPreview } from "./drag-preview/use-drag-preview";
import { useEffect, useState } from "react";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useProjectBackground } from "@/hooks/use-project-background";
import { cn } from "@/lib/cn";
import { useBackgroundStore } from "@/store/background";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import BulkToolbar from "../bulk-selection/bulk-toolbar";
import Column from "./column";
import TaskCard from "./task-card";

type KanbanBoardProps = {
  project: ProjectWithTasks;
  disableDragDrop?: boolean;
  disableCollectionActions?: boolean;
  sortedByNumber?: boolean;
  sortedByPriority?: boolean;
};

function KanbanBoard({
  project,
  disableDragDrop = false,
  disableCollectionActions = false,
  sortedByNumber = false,
  sortedByPriority = false,
}: KanbanBoardProps) {
  const isAutomaticallySorted = sortedByNumber || sortedByPriority;
  const queryClient = useQueryClient();
  const { project: storedProject, setProject } = useProjectStore();
  const setAvailableTasks = useBulkSelectionStore(
    (state) => state.setAvailableTasks,
  );
  const focusNext = useBulkSelectionStore((state) => state.focusNext);
  const focusPrevious = useBulkSelectionStore((state) => state.focusPrevious);
  const focusedTaskId = useBulkSelectionStore((state) => state.focusedTaskId);
  const clearFocus = useBulkSelectionStore((state) => state.clearFocus);
  const [activeIsFinal, setActiveIsFinal] = useState<boolean | undefined>();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [sortHintColumnId, setSortHintColumnId] = useState<string | null>(null);
  const dragPreview = useDragPreview(project);
  const { t } = useTranslation();
  const { mutate: reorder, isPending: isReordering } = useMutation({
    mutationFn: ({
      previousBoard: _previousBoard,
      ...request
    }: TaskReorder & { previousBoard: ProjectWithTasks }) =>
      reorderTasks(request),
    onMutate: (variables) => ({ previousBoard: variables.previousBoard }),
    onSuccess: (_result, variables) => {
      if (variables.tasks.some((task) => task.status !== undefined)) {
        invalidateMyWork(queryClient);
        void queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
      void queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      for (const task of variables.tasks)
        void queryClient.invalidateQueries({ queryKey: ["task", task.id] });
    },
    onError: (_error, variables, context) => {
      const previous = context?.previousBoard;
      if (previous) {
        const current = queryClient.getQueryData<ProjectWithTasks>([
          "tasks",
          variables.projectId,
        ]);
        const restored = current
          ? rollbackBoardReorder(current, previous, variables.tasks)
          : null;
        if (restored) {
          queryClient.setQueryData(["tasks", variables.projectId], restored);
          if (useProjectStore.getState().project?.id === variables.projectId)
            setProject(restored);
        }
      }
      toast.error(t("tasks:board.reorderFailed"));
      void queryClient.invalidateQueries({ queryKey: ["tasks", project.id] });
    },
  });
  const background = useProjectBackground({
    backgroundVersion: project.backgroundVersion,
    projectId: project.id,
    viewMode: "board",
  });
  const { setBackground } = useBackgroundStore();
  const navigate = useNavigate();

  useEffect(() => {
    setBackground(background);
  }, [background, setBackground]);

  useEffect(() => {
    return () => setBackground(null);
  }, [setBackground]);

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
    const isFinal = event.active.data?.current?.isFinalColumn;
    setActiveIsFinal(typeof isFinal === "boolean" ? isFinal : undefined);
  };

  const resetDrag = () => {
    setActiveId(null);
    setSortHintColumnId(null);
    dragPreview.clear();
  };

  const isDropBlocked = () =>
    disableDragDrop ||
    isReordering ||
    queryClient.getQueryState(["tasks", project.id])?.fetchStatus ===
      "fetching";

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || isDropBlocked()) {
      setSortHintColumnId(null);
      dragPreview.clear();
      return;
    }
    if (!isAutomaticallySorted) {
      dragPreview.hover(active, over);
      return;
    }
    setSortHintColumnId(
      findTaskColumn(project, over.id.toString())?.id ?? null,
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id.toString();
    const overId = over?.id.toString();
    const placement = overId
      ? dragPreview.getDropPlacement(activeId, overId)
      : null;
    resetDrag();

    if (!overId || !project?.columns || isDropBlocked()) return;
    const canonical = selectReorderBoard(
      project.id,
      activeId,
      queryClient.getQueryData<ProjectWithTasks>(["tasks", project.id]),
      storedProject,
    );
    if (!canonical) return;

    const moved = placement
      ? moveBoardTask(
          canonical,
          activeId,
          placement.overId,
          false,
          placement.insertAfterTarget,
        )
      : moveBoardTask(canonical, activeId, overId, isAutomaticallySorted);
    if (!moved || !moved.tasks.length) return;
    for (const task of moved.tasks)
      markBoardCacheChanged(queryClient, project.id, task.id);
    setProject(moved.project);
    queryClient.setQueryData(["tasks", project.id], moved.project);
    reorder({
      projectId: project.id,
      tasks: moved.tasks,
      expectedTasks: moved.expectedTasks,
      previousBoard: canonical,
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
            {[0, 1, 2, 3].map((i) => (
              <div
                key={`kanban-column-skeleton-${i}`}
                className="h-full min-w-80 w-full flex-1 rounded-xl border border-border/70 bg-card"
              >
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="w-24 h-5 bg-muted/50 rounded animate-pulse" />
                  <div className="w-8 h-5 bg-muted/50 rounded animate-pulse" />
                </div>

                <div className="px-2 pb-4 flex flex-col gap-3 flex-1">
                  {[0, 1, 2].map((j) => (
                    <div
                      key={`kanban-task-skeleton-${j}`}
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
      collisionDetection={boardCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={resetDrag}
    >
      <div
        className={cn("flex h-full w-full flex-col", {
          "bg-linear-to-b from-muted/20 to-background": !background,
        })}
      >
        <div className="min-h-0 flex-1 overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <div className="flex h-full min-w-max gap-4 px-4 py-4 md:px-5">
            {(dragPreview.preview ?? project).columns.map((column) => (
              <div
                key={column.id}
                className={cn("h-full max-w-96 min-w-80 shrink-0 flex-1", {
                  "h-fit": !!background,
                })}
              >
                <Column
                  column={column}
                  activeTaskId={activeId?.toString() ?? null}
                  sortHint={
                    column.id === sortHintColumnId
                      ? t("tasks:kanban.automaticallySortedHint", {
                          sort: t(
                            sortedByNumber
                              ? "tasks:sort.fields.number"
                              : "tasks:sort.fields.priority",
                          ),
                        })
                      : undefined
                  }
                  disableDragDrop={disableDragDrop}
                  disableSorting={isAutomaticallySorted}
                  disableCollectionActions={disableCollectionActions}
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
              <TaskCard task={activeTask} isFinalColumn={activeIsFinal} />
            </div>
          </div>
        ) : null}
      </DragOverlay>

      <BulkToolbar />
    </DndContext>
  );
}

export default KanbanBoard;
