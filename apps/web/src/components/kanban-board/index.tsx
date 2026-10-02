import { markBoardCacheChanged } from "@/lib/board-cache-version";
import { selectReorderBoard } from "./select-reorder-board";
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
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
import updateTaskPriority from "@/fetchers/task/update-task-priority";
import { toast } from "@/lib/toast";
import { useTranslation } from "react-i18next";
import { rollbackBoardReorder } from "./apply-reorder";
import { getVisualTaskPlacement, moveBoardTask } from "./move-task";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { produce } from "immer";
import {
  getModifierKeyText,
  useRegisterShortcuts,
} from "@/hooks/use-keyboard-shortcuts";
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

type HoverPlacement = {
  insertAfterTarget?: boolean;
  overId: string;
};

function KanbanBoard({
  project,
  disableDragDrop = false,
  disableCollectionActions = false,
  sortedByNumber = false,
  sortedByPriority = false,
}: KanbanBoardProps) {
  const isMac = getModifierKeyText() === "⌘";
  const queryClient = useQueryClient();
  const { project: storedProject, setProject } = useProjectStore();
  const {
    setAvailableTasks,
    focusNext,
    focusPrevious,
    focusedTaskId,
    clearFocus,
  } = useBulkSelectionStore();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [hoverPlacement, setHoverPlacement] = useState<HoverPlacement | null>(
    null,
  );
  const [dragPreviewProject, setDragPreviewProject] =
    useState<ProjectWithTasks | null>(null);
  const [isSortedReorderActive, setIsSortedReorderActive] = useState(false);
  const [isSortModifierHeld, setIsSortModifierHeld] = useState(false);
  const activeIdRef = useRef<UniqueIdentifier | null>(null);
  const dragPreviewProjectRef = useRef<ProjectWithTasks | null>(null);
  const hoverPlacementRef = useRef<HoverPlacement | null>(null);
  const isSortedReorderActiveRef = useRef(false);
  useLayoutEffect(() => {
    dragPreviewProjectRef.current = dragPreviewProject;
  }, [dragPreviewProject]);
  const { t } = useTranslation();
  const { mutate: reorder, isPending: isReordering } = useMutation({
    mutationFn: ({
      previousBoard: _previousBoard,
      ...request
    }: TaskReorder & { previousBoard: ProjectWithTasks }) =>
      reorderTasks(request),
    onMutate: (variables) => ({ previousBoard: variables.previousBoard }),
    onSuccess: (_result, variables) => {
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
  const { mutate: updatePriority } = useMutation({
    mutationFn: ({
      task,
      taskId,
    }: {
      task: Parameters<typeof updateTaskPriority>[1];
      taskId: string;
    }) => updateTaskPriority(taskId, task),
    onSuccess: (_updated, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["task", variables.taskId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["activities", variables.taskId],
      });
    },
    onError: () => {
      toast.error(t("tasks:popover.priority.updateError"));
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
    activeIdRef.current = event.active.id;
    setActiveId(event.active.id);
    setOverColumnId(null);
    dragPreviewProjectRef.current = null;
    hoverPlacementRef.current = null;
    setHoverPlacement(null);
    setDragPreviewProject(null);
    const activatorEvent = event.activatorEvent as
      | (Event & { metaKey?: boolean; ctrlKey?: boolean })
      | undefined;
    const modifierHeld = Boolean(
      activatorEvent?.metaKey || (!isMac && activatorEvent?.ctrlKey),
    );
    setIsSortModifierHeld(modifierHeld);
    isSortedReorderActiveRef.current = modifierHeld;
    setIsSortedReorderActive(modifierHeld);
  };

  const getColumnIdForOver = (overId: string) => {
    return (
      project.columns.find(
        (column) =>
          column.id === overId ||
          column.tasks.some((task) => task.id === overId),
      )?.id ?? null
    );
  };

  const handleDragHover = (event: DragOverEvent | DragMoveEvent) => {
    const overId = event.over?.id.toString();
    if (overId === activeIdRef.current?.toString()) return;
    setOverColumnId(overId ? getColumnIdForOver(overId) : null);
    if (!overId) {
      hoverPlacementRef.current = null;
      setHoverPlacement(null);
      return;
    }

    const translated = event.active.rect.current.translated;
    const insertAfterTarget =
      overId === getColumnIdForOver(overId)
        ? undefined
        : Boolean(
            translated &&
            translated.top + translated.height / 2 >
              event.over!.rect.top + event.over!.rect.height / 2,
          );
    hoverPlacementRef.current = { overId, insertAfterTarget };
    setHoverPlacement((current) =>
      current?.overId === overId &&
      current.insertAfterTarget === insertAfterTarget
        ? current
        : { overId, insertAfterTarget },
    );
  };

  useEffect(() => {
    if (!isSortedReorderActive || !activeId || !hoverPlacement) {
      dragPreviewProjectRef.current = null;
      setDragPreviewProject(null);
      return;
    }

    setDragPreviewProject((current) => {
      const next =
        moveBoardTask(
          current ?? project,
          activeId.toString(),
          hoverPlacement.overId,
          false,
          true,
          hoverPlacement.insertAfterTarget,
        )?.project ?? current;
      return next;
    });
  }, [activeId, hoverPlacement, isSortedReorderActive, project]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const shouldAllowSortedReorder = isSortedReorderActiveRef.current;
    const finalHoverPlacement = hoverPlacementRef.current;
    const finalPreviewProject = dragPreviewProjectRef.current;
    const visualPlacement =
      shouldAllowSortedReorder && finalPreviewProject
        ? getVisualTaskPlacement(finalPreviewProject, active.id.toString())
        : null;
    const finalPlacement = visualPlacement ?? finalHoverPlacement;
    setIsSortModifierHeld(false);
    activeIdRef.current = null;
    setActiveId(null);
    setOverColumnId(null);
    dragPreviewProjectRef.current = null;
    hoverPlacementRef.current = null;
    setHoverPlacement(null);
    setDragPreviewProject(null);
    isSortedReorderActiveRef.current = false;
    setIsSortedReorderActive(false);

    const activeId = active.id.toString();
    const overId =
      shouldAllowSortedReorder && finalPlacement
        ? finalPlacement.overId
        : over?.id === active.id
          ? overColumnId
          : over?.id.toString();

    if (!overId || !project?.columns) return;

    if (
      disableDragDrop ||
      isReordering ||
      queryClient.getQueryState(["tasks", project.id])?.fetchStatus ===
        "fetching"
    )
      return;
    const canonical = selectReorderBoard(
      project.id,
      activeId,
      queryClient.getQueryData<ProjectWithTasks>(["tasks", project.id]),
      storedProject,
    );
    if (!canonical) return;

    const sourceColumn = canonical.columns.find((column) =>
      column.tasks.some((task) => task.id === activeId),
    );
    const destinationColumn = canonical.columns.find(
      (column) =>
        column.id === overId || column.tasks.some((task) => task.id === overId),
    );
    const isCrossColumnMove =
      sourceColumn &&
      destinationColumn &&
      sourceColumn.id !== destinationColumn.id;
    const usesAppendOnlySortedMove =
      sortedByNumber ||
      (!shouldAllowSortedReorder &&
        (sortedByPriority || Boolean(isCrossColumnMove)));
    const moved = moveBoardTask(
      canonical,
      activeId,
      overId,
      usesAppendOnlySortedMove,
      shouldAllowSortedReorder,
      shouldAllowSortedReorder && finalPlacement
        ? finalPlacement.insertAfterTarget
        : undefined,
    );
    if (!moved || !moved.tasks.length) return;
    const activeTask = canonical.columns
      .flatMap((column) => column.tasks)
      .find((task) => task.id === activeId);
    const priorityTarget = shouldAllowSortedReorder
      ? canonical.columns
          .flatMap((column) => column.tasks)
          .find((task) => task.id === overId)
      : null;
    const movedProject =
      activeTask && priorityTarget
        ? produce(moved.project, (draft) => {
            const task = draft.columns
              .flatMap((column) => column.tasks)
              .find((task) => task.id === activeId);
            if (task) task.priority = priorityTarget.priority;
          })
        : moved.project;
    if (activeTask && priorityTarget) {
      updatePriority({
        taskId: activeId,
        task: {
          ...activeTask,
          priority: priorityTarget.priority,
        },
      });
    }
    for (const task of moved.tasks)
      markBoardCacheChanged(queryClient, project.id, task.id);
    setProject(movedProject);
    queryClient.setQueryData(["tasks", project.id], movedProject);
    reorder({
      projectId: project.id,
      tasks: moved.tasks,
      expectedTasks: moved.expectedTasks,
      previousBoard: canonical,
    });
  };

  useEffect(() => {
    const stopSorting = () => {
      setIsSortModifierHeld(false);
      isSortedReorderActiveRef.current = false;
      setIsSortedReorderActive(false);
      dragPreviewProjectRef.current = null;
      setDragPreviewProject(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Meta" &&
        !event.metaKey &&
        (isMac || (event.key !== "Control" && !event.ctrlKey))
      )
        return;
      if (!activeIdRef.current) return;
      setIsSortModifierHeld(true);
      isSortedReorderActiveRef.current = true;
      setIsSortedReorderActive(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (!event.metaKey && (isMac || !event.ctrlKey)) stopSorting();
    };
    const handleBlur = stopSorting;

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
      window.removeEventListener("blur", handleBlur);
    };
  }, [isMac]);

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

  const displayedProject = dragPreviewProject ?? project;
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
      onDragMove={handleDragHover}
      onDragOver={handleDragHover}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setIsSortModifierHeld(false);
        activeIdRef.current = null;
        setActiveId(null);
        setOverColumnId(null);
        dragPreviewProjectRef.current = null;
        hoverPlacementRef.current = null;
        setHoverPlacement(null);
        setDragPreviewProject(null);
        isSortedReorderActiveRef.current = false;
        setIsSortedReorderActive(false);
      }}
    >
      <div
        className={cn("flex h-full w-full flex-col", {
          "bg-linear-to-b from-muted/20 to-background": !background,
        })}
      >
        <div className="min-h-0 flex-1 overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <div className="flex h-full min-w-max gap-4 px-4 py-4 md:px-5">
            {displayedProject.columns?.map((column) => (
              <div
                key={column.id}
                className={cn("h-full max-w-96 min-w-80 shrink-0 flex-1", {
                  "h-fit": !!background,
                })}
              >
                <Column
                  column={column}
                  isDragPreview={dragPreviewProject !== null}
                  activeTaskId={activeId?.toString() ?? null}
                  sourceColumnId={
                    project.columns.find((column) =>
                      column.tasks.some((task) => task.id === activeId),
                    )?.id
                  }
                  isPriorityOverlaySuppressed={isSortModifierHeld}
                  priorityOverlayColumnId={overColumnId}
                  disableDragDrop={disableDragDrop}
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
              <TaskCard task={activeTask} />
            </div>
          </div>
        ) : null}
      </DragOverlay>

      <BulkToolbar />
    </DndContext>
  );
}

export default KanbanBoard;
