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
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { useNavigate } from "@tanstack/react-router";
import { produce } from "immer";
import { Flag } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { priorityColorsTaskCard } from "@/constants/priority-colors";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useBoardSort } from "@/hooks/use-board-sort";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { flattenTree, groupNestedByColumn } from "@/lib/build-task-hierarchy";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import useBulkSelectionStore from "@/store/bulk-selection";
import useHierarchyExpansionStore from "@/store/hierarchy-expansion";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type { ProjectWithTasks } from "@/types/project";
import BulkToolbar from "../bulk-selection/bulk-toolbar";
import { ArchiveTasksModal } from "../shared/modals/archive-tasks-modal";
import CreateTaskModal from "../shared/modals/create-task-modal";
import ColumnSection from "./column-section";
import TaskTreeList from "./task-tree-list";

type ListViewProps = {
  project: ProjectWithTasks;
  disableDragDrop?: boolean;
};

function ListView({ project, disableDragDrop = false }: ListViewProps) {
  const { t } = useTranslation();
  const { setProject } = useProjectStore();
  const { hierarchyMode } = useUserPreferencesStore();
  const { sort } = useBoardSort(project.id);
  const {
    setAvailableTasks,
    focusNext,
    focusPrevious,
    focusedTaskId,
    clearFocus,
  } = useBulkSelectionStore();
  const { isExpanded, toggleExpanded } = useHierarchyExpansionStore();
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

  const hierarchyDragDisabled =
    disableDragDrop || hierarchyMode === "tree" || hierarchyMode === "nested";

  const expandedIds = useHierarchyExpansionStore(
    (state) => state.expandedTaskIds[project.id] ?? [],
  );
  const expandedSet = useMemo(() => new Set(expandedIds), [expandedIds]);

  const allTasks = useMemo(
    () => project.columns.flatMap((column) => column.tasks),
    [project.columns],
  );

  const treeTasks = useMemo(() => {
    if (hierarchyMode !== "tree") {
      return [];
    }
    return flattenTree(allTasks, expandedSet, sort);
  }, [allTasks, expandedSet, hierarchyMode, sort]);

  const nestedColumns = useMemo(() => {
    if (hierarchyMode !== "nested") {
      return project.columns;
    }
    return groupNestedByColumn(project.columns, expandedSet, sort);
  }, [project.columns, expandedSet, hierarchyMode, sort]);

  const visibleTaskIds = useMemo(() => {
    if (hierarchyMode === "tree") {
      return treeTasks.map((task) => task.id);
    }

    const columns =
      hierarchyMode === "nested" ? nestedColumns : project.columns;

    return columns
      .filter((column) => expandedSections[column.id])
      .flatMap((column) => column.tasks.map((task) => task.id));
  }, [
    expandedSections,
    hierarchyMode,
    nestedColumns,
    project.columns,
    treeTasks,
  ]);

  useEffect(() => {
    setAvailableTasks(visibleTaskIds);
  }, [setAvailableTasks, visibleTaskIds]);

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
      activationConstraint: { distance: hierarchyDragDisabled ? 999999 : 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: hierarchyDragDisabled ? 999999 : 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const handleToggleExpand = useCallback(
    (taskId: string) => {
      toggleExpanded(project.id, taskId);
    },
    [project.id, toggleExpanded],
  );

  const checkExpanded = useCallback(
    (taskId: string) => isExpanded(project.id, taskId),
    [project.id, isExpanded],
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

    if (!over || !project?.columns || hierarchyMode !== "flat") return;

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
            status: destinationColumn.id,
            position: index,
          });
        });
      } else {
        task.status = destinationColumn.id;
        const destinationIndex =
          overId === destinationColumn.id
            ? destinationColumn.tasks.length
            : destinationColumn.tasks.findIndex((t) => t.id === overId) + 1;

        destinationColumn.tasks.splice(destinationIndex, 0, task);

        destinationColumn.tasks.forEach((t, index) => {
          updateTask({
            ...t,
            status: destinationColumn.id,
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

  if (!project?.columns) {
    return null;
  }

  const activeTask = activeId
    ? project.columns
        ?.flatMap((col) => col.tasks)
        .find((task) => task.id === activeId)
    : null;

  const columnsToRender =
    hierarchyMode === "nested" ? nestedColumns : project.columns;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      modifiers={[snapCenterToCursor]}
    >
      <div className="w-full h-full overflow-auto bg-muted/20">
        {hierarchyMode === "tree" ? (
          <TaskTreeList
            tasks={treeTasks}
            projectSlug={project.slug ?? ""}
            isExpanded={checkExpanded}
            onToggleExpand={handleToggleExpand}
          />
        ) : (
          <div className="divide-y divide-border/50">
            {columnsToRender.map((column) => (
              <ColumnSection
                key={column.id}
                column={column}
                projectSlug={project.slug ?? ""}
                hierarchyMode={hierarchyMode}
                tasks={hierarchyMode === "nested" ? column.tasks : undefined}
                expandedSections={expandedSections}
                activeId={activeId}
                overColumnId={overColumnId}
                onToggleSection={toggleSection}
                onAddTask={(columnId) => {
                  setIsTaskModalOpen(true);
                  setActiveColumn(columnId);
                }}
                onArchiveClick={handleArchiveClick}
                onToggleExpand={handleToggleExpand}
                isExpanded={checkExpanded}
              />
            ))}
          </div>
        )}
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
