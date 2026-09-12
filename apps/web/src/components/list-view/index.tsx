import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { produce } from "immer";
import { Archive, ChevronRight, Flag, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { priorityColorsTaskCard } from "@/constants/priority-colors";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import useGetProjectTaskRelations from "@/hooks/queries/task-relation/use-get-project-task-relations";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/cn";
import { getColumnIcon } from "@/lib/column";
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
import TaskRow from "./task-row";

type ListViewProps = {
  project: ProjectWithTasks;
  disableDragDrop?: boolean;
};

function ListView({ project, disableDragDrop = false }: ListViewProps) {
  const { t } = useTranslation();
  const { setProject } = useProjectStore();
  const {
    setAvailableTasks,
    focusNext,
    focusPrevious,
    focusedTaskId,
    clearFocus,
  } = useBulkSelectionStore();
  const { mutate: updateTask } = useUpdateTask();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >(() => {
    const sections: Record<string, boolean> = {};
    if (project?.columns) {
      for (const col of project.columns) {
        sections[col.id] = true;
      }
    }
    return sections;
  });
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [columnToArchive, setColumnToArchive] = useState<
    ProjectWithTasks["columns"][number] | null
  >(null);

  const { data: relations } = useGetProjectTaskRelations(project?.id ?? "");

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

  const toggleTaskExpanded = useCallback((rowId: string) => {
    setExpanded((previous) => ({
      ...previous,
      rows: { ...previous.rows, [rowId]: !previous.rows[rowId] },
    }));
  }, []);

  useEffect(() => {
    if (project?.columns) {
      const visibleTaskIds = project.columns
        .filter((column) => expandedSections[column.id])
        .flatMap((column) => column.tasks.map((task) => task.id));
      setAvailableTasks(visibleTaskIds);
    }
  }, [project, expandedSections, setAvailableTasks]);

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
        delay: disableDragDrop ? 999999 : 200,
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

  // Escape ends a drag without onDragEnd, so without this the dragged row
  // stays active: its children remain collapsed and the overlay lingers.
  const handleDragCancel = () => {
    setActiveId(null);
    setOverColumnId(null);
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleArchiveClick = (column: ProjectWithTasks["columns"][number]) => {
    if (!column.isFinal || column.tasks.length === 0) return;
    setColumnToArchive(column);
    setIsArchiveModalOpen(true);
  };

  const handleConfirmArchive = () => {
    if (!columnToArchive) return;

    const updatedProject = produce(project, (draft) => {
      const archivedColumn = draft?.columns?.find(
        (col) => col.id === columnToArchive.id,
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
      t("tasks:archive.success", { count: columnToArchive.tasks.length }),
    );

    setIsArchiveModalOpen(false);
    setColumnToArchive(null);
  };

  function ColumnSection({
    column,
  }: {
    column: ProjectWithTasks["columns"][number];
  }) {
    const { setNodeRef } = useDroppable({
      id: column.id,
      data: {
        type: "column",
        column,
      },
    });

    const showDropIndicator = activeId && overColumnId === column.id;

    // A dragged parent collapses for the duration: moving a row while its
    // children are rendered beneath it has no single correct outcome, and
    // hiding them keeps the drag to the one row the user grabbed.
    // Reserving the toggle column on every row keeps the titles aligned, but
    // only where the group actually has subtasks; a project without any keeps
    // the original left edge.
    const rows = flattenSubtaskRows({
      tasks: column.tasks,
      children: subtaskChildren,
      tasksById,
      isExpanded: (rowId) => {
        if (!expandedTasks[rowId]) return false;
        // activeId is the dragged row's id, which is a bare task id because
        // only top-level rows drag. The same task can also be rendered at
        // "parent/child", and those occurrences have to collapse too.
        const taskId = rowId.slice(rowId.lastIndexOf("/") + 1);
        return activeId !== taskId;
      },
    });

    const groupHasSubtasks = rows.some(
      (row) => row.childCount > 0 || row.depth > 0,
    );

    return (
      <div
        className={cn(
          "border-b border-border/50 transition-colors duration-150 overflow-auto",
          showDropIndicator && "border-l-4 border-l-ring bg-accent/35",
        )}
      >
        <div className="flex items-center justify-between py-2 px-4 bg-muted/60 border-b border-border/50">
          <button
            type="button"
            onClick={() => toggleSection(column.id)}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight
              className={cn(
                "w-3 h-3 transition-transform",
                expandedSections[column.id] && "rotate-90",
              )}
            />
            <div className="flex items-center gap-2 h-4">
              {getColumnIcon(column.id, column.isFinal, column.icon)}
              <div className="flex items-center gap-1">
                <span className="mt-1 mr-1">{column.name}</span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  {column.tasks.length}
                </span>
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setIsTaskModalOpen(true);
                setActiveColumn(column.id);
              }}
              className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
              title={t("tasks:listView.addTask")}
            >
              <Plus className="w-3 h-3" />
            </button>

            {column.isFinal && column.tasks.length > 0 && (
              <button
                type="button"
                onClick={() => handleArchiveClick(column)}
                className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                title={t("tasks:listView.archiveAllTooltip")}
              >
                <Archive className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {expandedSections[column.id] && (
          <div
            ref={setNodeRef}
            className="bg-card transition-[translate,opacity] duration-150 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
          >
            {/* Only the top-level rows are sortable; the nested repeats share
                their task id with one of them. */}
            <SortableContext
              items={column.tasks}
              strategy={verticalListSortingStrategy}
            >
              <AnimatePresence initial={false} mode="popLayout">
                {rows.map((row) => (
                  <motion.div
                    key={row.rowId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                  >
                    <TaskRow
                      task={row.task}
                      projectSlug={project?.slug ?? ""}
                      reserveToggleSpace={groupHasSubtasks}
                      isTaskDragging={activeId === row.task.id}
                      depth={row.depth}
                      rowId={row.rowId}
                      childCount={row.childCount}
                      isExpanded={Boolean(expandedTasks[row.rowId])}
                      onToggleExpanded={() => toggleTaskExpanded(row.rowId)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </SortableContext>

            {column.tasks.length === 0 && (
              <div className="py-6 px-4 text-center text-xs text-muted-foreground">
                {t("tasks:listView.noTasks")}
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
      onDragCancel={handleDragCancel}
      modifiers={[snapCenterToCursor]}
    >
      <div className="w-full h-full overflow-auto bg-muted/20">
        <div className="divide-y divide-border/50">
          {project.columns.map((column) => (
            <ColumnSection key={column.id} column={column} />
          ))}
        </div>
      </div>

      <DragOverlay>
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
        onConfirm={handleConfirmArchive}
        taskCount={columnToArchive?.tasks.length ?? 0}
      />

      <BulkToolbar />
    </DndContext>
  );
}

export default ListView;
