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
import { useVirtualizer } from "@tanstack/react-virtual";
import { produce } from "immer";
import { Archive, ChevronRight, Flag, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { priorityColorsTaskCard } from "@/constants/priority-colors";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/cn";
import { getColumnIcon } from "@/lib/column";
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

type Column = ProjectWithTasks["columns"][number];
type Task = Column["tasks"][number];

type ListRow =
  | { type: "header"; key: string; column: Column }
  | { type: "task"; key: string; columnId: string; task: Task }
  | { type: "empty"; key: string; column: Column };

type ColumnHeaderRowProps = {
  column: Column;
  expanded: boolean;
  showDropIndicator: boolean;
  onToggle: () => void;
  onAddTask: () => void;
  onArchive: () => void;
};

function ColumnHeaderRow({
  column,
  expanded,
  showDropIndicator,
  onToggle,
  onAddTask,
  onArchive,
}: ColumnHeaderRowProps) {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({
    id: column.id,
    disabled: expanded && column.tasks.length === 0,
    data: {
      type: "column",
      column,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center justify-between py-2 px-4 bg-muted/60 border-b border-border/50 transition-colors duration-150",
        showDropIndicator && "border-l-4 border-l-ring bg-accent/35",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight
          className={cn(
            "w-3 h-3 transition-transform",
            expanded && "rotate-90",
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
          onClick={onAddTask}
          className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
          title={t("tasks:listView.addTask")}
        >
          <Plus className="w-3 h-3" />
        </button>

        {column.isFinal && column.tasks.length > 0 && (
          <button
            type="button"
            onClick={onArchive}
            className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
            title={t("tasks:listView.archiveAllTooltip")}
          >
            <Archive className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyColumnRow({
  column,
  showDropIndicator,
}: {
  column: Column;
  showDropIndicator: boolean;
}) {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: {
      type: "column",
      column,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "py-6 px-4 text-center text-xs text-muted-foreground bg-card border-b border-border/50 transition-colors duration-150",
        showDropIndicator && "border-l-4 border-l-ring bg-accent/35",
      )}
    >
      {t("tasks:listView.noTasks")}
    </div>
  );
}

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

        const firstChangedIndex = Math.min(sourceTaskIndex, destinationIndex);
        const lastChangedIndex = Math.max(sourceTaskIndex, destinationIndex);
        destinationColumn.tasks
          .slice(firstChangedIndex, lastChangedIndex + 1)
          .forEach((t, offset) => {
            updateTask({
              ...t,
              status: destinationColumn.slug,
              position: firstChangedIndex + offset,
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

        destinationColumn.tasks.slice(destinationIndex).forEach((t, offset) => {
          updateTask({
            ...t,
            status: destinationColumn.slug,
            position: destinationIndex + offset,
          });
        });

        sourceColumn.tasks.slice(sourceTaskIndex).forEach((t, offset) => {
          updateTask({
            ...t,
            position: sourceTaskIndex + offset,
          });
        });
      }
    });

    setProject(updatedProject);
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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rows = useMemo<ListRow[]>(() => {
    const nextRows: ListRow[] = [];

    for (const column of project.columns) {
      nextRows.push({
        type: "header",
        key: `header:${column.id}`,
        column,
      });

      if (!expandedSections[column.id]) continue;

      if (column.tasks.length === 0) {
        nextRows.push({
          type: "empty",
          key: `empty:${column.id}`,
          column,
        });
        continue;
      }

      for (const task of column.tasks) {
        nextRows.push({
          type: "task",
          key: `task:${task.id}`,
          columnId: column.id,
          task,
        });
      }
    }

    return nextRows;
  }, [expandedSections, project.columns]);
  const sortableTaskIds = useMemo(
    () => rows.flatMap((row) => (row.type === "task" ? [row.task.id] : [])),
    [rows],
  );
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => (rows[index]?.type === "empty" ? 73 : 41),
    initialRect: { width: 1024, height: 800 },
    getItemKey: (index) => rows[index]?.key ?? index,
    overscan: 10,
  });

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
      modifiers={[snapCenterToCursor]}
    >
      <div
        ref={scrollContainerRef}
        className="w-full h-full overflow-auto bg-muted/20"
      >
        <div
          className="relative w-full"
          style={{ height: rowVirtualizer.getTotalSize() }}
        >
          <SortableContext
            items={sortableTaskIds}
            strategy={verticalListSortingStrategy}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;

              return (
                <div
                  key={row.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  className="absolute top-0 left-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  {row.type === "header" && (
                    <ColumnHeaderRow
                      column={row.column}
                      expanded={expandedSections[row.column.id]}
                      showDropIndicator={
                        Boolean(activeId) && overColumnId === row.column.id
                      }
                      onToggle={() => toggleSection(row.column.id)}
                      onAddTask={() => {
                        setIsTaskModalOpen(true);
                        setActiveColumn(row.column.id);
                      }}
                      onArchive={() => handleArchiveClick(row.column)}
                    />
                  )}

                  {row.type === "task" && (
                    <div
                      className={cn(
                        "bg-card transition-colors duration-150",
                        activeId &&
                          overColumnId === row.columnId &&
                          "border-l-4 border-l-ring bg-accent/35",
                      )}
                    >
                      <TaskRow
                        task={row.task}
                        projectSlug={project.slug ?? ""}
                      />
                    </div>
                  )}

                  {row.type === "empty" && (
                    <EmptyColumnRow
                      column={row.column}
                      showDropIndicator={
                        Boolean(activeId) && overColumnId === row.column.id
                      }
                    />
                  )}
                </div>
              );
            })}
          </SortableContext>
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
