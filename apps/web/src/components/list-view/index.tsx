import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { produce } from "immer";
import { Flag, ArchiveIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { priorityColorsTaskCard } from "@/constants/priority-colors";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import useGetProjectTaskRelations from "@/hooks/queries/task-relation/use-get-project-task-relations";
import { useTaskViewShortcuts } from "@/components/project/task-view-keys/use-task-view-shortcuts";
import { useCollapsedSections } from "@/hooks/use-collapsed-sections";
import { cn } from "@/lib/cn";
import {
  readExpandedRows,
  writeExpandedRows,
} from "@/lib/expanded-rows-storage";
import { buildSubtaskChildren, flattenSubtaskRows } from "@/lib/subtask-tree";
import { toast } from "@/lib/toast";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import BulkToolbar from "../bulk-selection/bulk-toolbar";
import { ArchiveTasksModal } from "../shared/modals/archive-tasks-modal";
import CreateTaskModal from "../shared/modals/create-task-modal";
import ListColumnSection from "./list-column-section";

type ListViewProps = {
  project: ProjectWithTasks;
  disableDragDrop?: boolean;
  disableCollectionActions?: boolean;
};

function ListView({
  project,
  disableDragDrop = false,
  disableCollectionActions = false,
}: ListViewProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const { setProject } = useProjectStore();
  const setAvailableTasks = useBulkSelectionStore(
    (state) => state.setAvailableTasks,
  );
  const clearFocus = useBulkSelectionStore((state) => state.clearFocus);
  const { mutate: updateTask } = useUpdateTask();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const { isExpanded, toggleSection, toggleAllSections } = useCollapsedSections(
    project.id,
    "list",
  );
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [columnToArchive, setColumnToArchive] = useState<string | null>(null);
  const archiveColumn = project.columns.find(
    (column) => column.id === columnToArchive,
  );

  // isLoading rather than isPending: a disabled query is also pending, and an
  // empty project should not look like it is still fetching.
  const {
    data: relations,
    isLoading: relationsLoading,
    isError: relationsFailed,
    refetch: refetchRelations,
  } = useGetProjectTaskRelations(project?.id ?? "");

  const subtaskChildren = useMemo(
    () => buildSubtaskChildren(relations ?? []),
    [relations],
  );

  const tasksById = useMemo(() => {
    const index = new Map<
      string,
      ProjectWithTasks["columns"][number]["tasks"][number]
    >();
    for (const column of project?.columns ?? []) {
      for (const task of column.tasks) {
        index.set(task.id, task);
      }
    }
    return index;
  }, [project?.columns]);

  // Per viewer and per project, and only a convenience: a row that cannot be
  // restored simply starts collapsed.
  const projectId = project?.id ?? "";
  const [expanded, setExpanded] = useState(() => ({
    projectId,
    rows: readExpandedRows(projectId),
  }));

  // The board route swaps this component's project rather than remounting it,
  // so a lazy initializer would keep the previous project's map and then save
  // it under the new project's key.
  if (expanded.projectId !== projectId) {
    setExpanded({ projectId, rows: readExpandedRows(projectId) });
  }

  const expandedTasks = expanded.rows;

  useEffect(() => {
    writeExpandedRows(projectId, expandedTasks);
  }, [projectId, expandedTasks]);

  // Collapsing removes the row rather than recording false, so the stored map
  // holds only expanded rows and does not grow with every row ever touched.
  const toggleTaskExpanded = useCallback((rowId: string) => {
    setExpanded((previous) => {
      const rows = { ...previous.rows };
      if (rows[rowId]) delete rows[rowId];
      else rows[rowId] = true;
      return { ...previous, rows };
    });
  }, []);

  // Each section's rows, in the order they are shown, expanded subtasks
  // included. Built once per change and shared with the sections, so their
  // memoization holds. Nothing stays expanded while a drag is in flight.
  const rowsByColumn = useMemo(
    () =>
      new Map(
        (project?.columns ?? []).map((column) => [
          column.id,
          flattenSubtaskRows({
            tasks: column.tasks,
            children: subtaskChildren,
            tasksById,
            isExpanded: (rowId) => !activeId && Boolean(expandedTasks[rowId]),
          }),
        ]),
      ),
    [project?.columns, subtaskChildren, tasksById, expandedTasks, activeId],
  );

  // j/k, select-all and shift-click ranges follow this order, so it is the
  // order rows are shown in. Selection and focus stay per task, so a task
  // shown both under its parent and in its own place is listed once, where it
  // first appears.
  const shownTaskIds = useCallback(
    (column: ProjectWithTasks["columns"][number]) => [
      ...new Set((rowsByColumn.get(column.id) ?? []).map((row) => row.task.id)),
    ],
    [rowsByColumn],
  );

  useEffect(() => {
    if (project?.columns) {
      const visibleTaskIds = project.columns
        .filter((column) => isExpanded(column.id))
        .flatMap(shownTaskIds);
      setAvailableTasks([...new Set(visibleTaskIds)]);
    }
  }, [project, isExpanded, setAvailableTasks, shownTaskIds]);

  useEffect(() => {
    clearFocus();
  }, [clearFocus]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: disableDragDrop ? 999999 : 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: disableDragDrop ? 999999 : 200,
        tolerance: 8,
      },
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (disableDragDrop) return;
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over || !activeId) {
      setOverColumnId(null);
      return;
    }

    if (project?.columns?.some((col) => col.id === over.id)) {
      setOverColumnId(over.id.toString());
      return;
    }

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

  const moveTask = (activeTaskId: string, overId: string) => {
    if (disableDragDrop || !project?.columns) return;

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
            status: destinationColumn.slug,
            position: index,
          });
        });
      } else {
        // A task's status is a column slug. The column id is only the
        // droppable identity here, and the two are interchangeable only
        // because the tasks endpoint happens to return `id: column.slug`.
        task.status = destinationColumn.slug;
        const destinationIndex =
          overId === destinationColumn.id
            ? destinationColumn.tasks.length
            : destinationColumn.tasks.findIndex((t) => t.id === overId) + 1;

        destinationColumn.tasks.splice(destinationIndex, 0, task);

        destinationColumn.tasks.forEach((t, index) => {
          updateTask({
            ...t,
            status: destinationColumn.slug,
            position: index,
          });
        });

        sourceColumn.tasks.forEach((t, index) => {
          updateTask({
            ...t,
            position: index,
          });
        });
      }
    });

    setProject(updatedProject);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setOverColumnId(null);
    if (over) moveTask(active.id.toString(), over.id.toString());
  };

  // Escape ends a drag without onDragEnd, so without this the dragged row
  // stays active: its children remain collapsed and the overlay lingers.
  const handleDragCancel = () => {
    setActiveId(null);
    setOverColumnId(null);
  };

  useTaskViewShortcuts({
    layout: "list",
    selection: useBulkSelectionStore,
    getGroups: () =>
      project.columns.map((column) => ({
        id: column.id,
        taskIds: shownTaskIds(column),
        collapsed: !isExpanded(column.id),
      })),
    project,
    enabled: activeId === null,
    canMove: !disableDragDrop,
    onMove: moveTask,
    onToggleGroup: toggleSection,
    onToggleAllGroups: () =>
      toggleAllSections(project.columns.map((column) => column.id)),
  });

  const handleAddTask = useCallback((columnId: string) => {
    setIsTaskModalOpen(true);
    setActiveColumn(columnId);
  }, []);

  const handleArchiveClick = useCallback(
    (column: ProjectWithTasks["columns"][number]) => {
      if (
        disableCollectionActions ||
        !column.isFinal ||
        column.tasks.length === 0
      )
        return;
      setColumnToArchive(column.id);
      setIsArchiveModalOpen(true);
    },
    [disableCollectionActions],
  );

  const handleConfirmArchive = () => {
    if (disableCollectionActions || !archiveColumn?.isFinal) return;

    const updatedProject = produce(project, (draft) => {
      const archivedColumn = draft?.columns?.find(
        (col) => col.id === columnToArchive,
      );
      if (!archivedColumn) return;

      for (const task of archivedColumn.tasks) {
        updateTask({
          ...task,
          status: "archived",
        });
      }

      archivedColumn.tasks = [];
    });

    setProject(updatedProject);
    toast.success(
      t("tasks:archive.success", { count: archiveColumn.tasks.length }),
      { icon: ArchiveIcon },
    );

    setIsArchiveModalOpen(false);
    setColumnToArchive(null);
  };

  if (!project?.columns) {
    return null;
  }

  const activeTask = activeId
    ? project.columns
        ?.flatMap((col) => col.tasks)
        .find((task) => task.id === activeId)
    : null;

  return (
    <DndContext
      sensors={disableDragDrop ? [] : sensors}
      accessibility={{
        screenReaderInstructions: {
          draggable: t("tasks:board.keyboardInstructions"),
        },
      }}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      modifiers={[snapCenterToCursor]}
    >
      <div className="w-full h-full overflow-auto bg-muted/20">
        {relationsFailed && (
          // Without relations every task renders as a top-level row, which
          // reads exactly like a project with no subtasks; this says it isn't.
          <div
            role="alert"
            className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-2 text-sm text-muted-foreground"
          >
            <span>{t("tasks:listView.subtasksLoadError")}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetchRelations()}
            >
              {t("common:error.tryAgain")}
            </Button>
          </div>
        )}
        <div aria-busy={relationsLoading} className="divide-y divide-border/50">
          {project.columns.map((column) => (
            <ListColumnSection
              key={column.id}
              column={column}
              projectSlug={project.slug ?? ""}
              isExpanded={isExpanded(column.id)}
              showDropIndicator={
                Boolean(activeId) && overColumnId === column.id
              }
              disableCollectionActions={disableCollectionActions}
              onToggle={toggleSection}
              onAddTask={handleAddTask}
              onArchive={handleArchiveClick}
              rows={rowsByColumn.get(column.id) ?? []}
              onToggleTaskExpanded={toggleTaskExpanded}
              relationsLoading={relationsLoading}
              draggingTaskId={activeId === null ? null : String(activeId)}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={reduceMotion ? null : undefined}>
        {activeTask && (
          <div className="bg-card border border-border rounded-lg shadow-lg p-2 max-w-[200px] cursor-grabbing">
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0">
                <Flag
                  className={cn(
                    "w-3 h-3",
                    priorityColorsTaskCard[
                      activeTask.priority as keyof typeof priorityColorsTaskCard
                    ],
                  )}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {project?.slug}-{activeTask.number}
                  </span>
                  <span className="text-xs text-foreground truncate">
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
        projectId={project.id}
        onClose={() => setIsTaskModalOpen(false)}
        status={activeColumn ?? "done"}
      />
      <ArchiveTasksModal
        open={isArchiveModalOpen}
        onClose={() => {
          setIsArchiveModalOpen(false);
          setColumnToArchive(null);
        }}
        disabled={disableCollectionActions}
        onConfirm={handleConfirmArchive}
        taskCount={archiveColumn?.tasks.length ?? 0}
      />

      <BulkToolbar />
    </DndContext>
  );
}

export default ListView;
