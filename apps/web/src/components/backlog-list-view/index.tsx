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
import { Archive, Clock, Flag } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { priorityColorsTaskCard } from "@/constants/priority-colors";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useTaskViewShortcuts } from "@/components/project/task-view-keys/use-task-view-shortcuts";
import { cn } from "@/lib/cn";
import useBacklogBulkSelectionStore from "@/store/backlog-bulk-selection";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import BacklogBulkToolbar from "../bulk-selection/backlog-bulk-toolbar";
import CreateTaskModal from "../shared/modals/create-task-modal";
import BacklogSection from "./backlog-section";

type BacklogListViewProps = {
  project?: ProjectWithTasks;
  disableDragDrop?: boolean;
};

function BacklogListView({
  project,
  disableDragDrop = false,
}: BacklogListViewProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const { mutate: updateTask } = useUpdateTask();
  const setProject = useProjectStore((state) => state.setProject);
  const setAvailableTasks = useBacklogBulkSelectionStore(
    (state) => state.setAvailableTasks,
  );
  const clearFocus = useBacklogBulkSelectionStore((state) => state.clearFocus);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    planned: true,
    archived: true,
  });
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      const visibleTaskIds: string[] = [];
      if (expandedSections.planned) {
        visibleTaskIds.push(
          ...(project.plannedTasks || []).map((task) => task.id),
        );
      }
      if (expandedSections.archived) {
        visibleTaskIds.push(
          ...(project.archivedTasks || []).map((task) => task.id),
        );
      }
      setAvailableTasks(visibleTaskIds);
    }
  }, [project, expandedSections, setAvailableTasks]);

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
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over || !activeId) {
      setOverColumnId(null);
      return;
    }

    if (over.id === "planned" || over.id === "archived") {
      setOverColumnId(over.id.toString());
      return;
    }

    const taskId = over.id.toString();
    const plannedTasks = project?.plannedTasks || [];
    const archivedTasks = project?.archivedTasks || [];

    if (plannedTasks.some((task) => task.id === taskId)) {
      setOverColumnId("planned");
    } else if (archivedTasks.some((task) => task.id === taskId)) {
      setOverColumnId("archived");
    } else {
      setOverColumnId(null);
    }
  };

  const moveTask = (activeTaskId: string, overId: string) => {
    if (!project) return;

    const plannedTasks = project.plannedTasks || [];
    const archivedTasks = project.archivedTasks || [];
    const activeTask = [...plannedTasks, ...archivedTasks].find(
      (task) => task.id === activeTaskId,
    );

    if (!activeTask) return;

    let targetSection = overId;
    if (overId !== "planned" && overId !== "archived") {
      if (plannedTasks.some((task) => task.id === overId)) {
        targetSection = "planned";
      } else if (archivedTasks.some((task) => task.id === overId)) {
        targetSection = "archived";
      } else {
        return;
      }
    }

    const updatedProject = produce(project, (draft) => {
      const sourceSection =
        activeTask.status === "planned"
          ? draft.plannedTasks || []
          : draft.archivedTasks || [];

      const sourceTaskIndex = sourceSection.findIndex(
        (task) => task.id === activeTaskId,
      );
      const task = sourceSection[sourceTaskIndex];

      if (!task) return;

      if (activeTask.status === "planned") {
        draft.plannedTasks =
          draft.plannedTasks?.filter((t) => t.id !== activeTaskId) || [];
      } else {
        draft.archivedTasks =
          draft.archivedTasks?.filter((t) => t.id !== activeTaskId) || [];
      }

      if (activeTask.status === targetSection) {
        const targetSectionTasks =
          activeTask.status === "planned"
            ? draft.plannedTasks || []
            : draft.archivedTasks || [];

        let destinationIndex = targetSectionTasks.findIndex(
          (t) => t.id === overId,
        );

        if (sourceTaskIndex <= destinationIndex) {
          destinationIndex += 1;
        }

        if (activeTask.status === "planned") {
          draft.plannedTasks?.splice(destinationIndex, 0, task);
        } else {
          draft.archivedTasks?.splice(destinationIndex, 0, task);
        }

        const finalTasks =
          activeTask.status === "planned"
            ? draft.plannedTasks || []
            : draft.archivedTasks || [];

        finalTasks.forEach((t, index) => {
          updateTask({
            ...t,
            position: index,
          });
        });
      } else {
        task.status = targetSection;

        if (targetSection === "planned") {
          draft.plannedTasks = [...(draft.plannedTasks || []), task];
        } else {
          draft.archivedTasks = [...(draft.archivedTasks || []), task];
        }

        const updatedTasks =
          targetSection === "planned"
            ? draft.plannedTasks || []
            : draft.archivedTasks || [];

        updatedTasks.forEach((t, index) => {
          updateTask({
            ...t,
            status: targetSection,
            position: index,
          });
        });

        const sourceTasks =
          activeTask.status === "planned"
            ? draft.plannedTasks || []
            : draft.archivedTasks || [];

        sourceTasks.forEach((t, index) => {
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

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }, []);

  const toggleAllSections = useCallback(() => {
    setExpandedSections((prev) => {
      const expand = !prev.planned && !prev.archived;
      return { planned: expand, archived: expand };
    });
  }, []);

  useTaskViewShortcuts({
    layout: "list",
    selection: useBacklogBulkSelectionStore,
    getGroups: () => [
      {
        id: "planned",
        taskIds: (project?.plannedTasks ?? []).map((task) => task.id),
        collapsed: !expandedSections.planned,
      },
      {
        id: "archived",
        taskIds: (project?.archivedTasks ?? []).map((task) => task.id),
        collapsed: !expandedSections.archived,
      },
    ],
    project,
    enabled: activeId === null,
    canMove: !disableDragDrop,
    onMove: moveTask,
    onToggleGroup: toggleSection,
    onToggleAllGroups: toggleAllSections,
  });

  const openPlannedTaskModal = useCallback(() => {
    setIsTaskModalOpen(true);
    setActiveColumn("planned");
  }, []);

  if (!project) {
    return null;
  }

  const plannedTasks = project.plannedTasks || [];
  const archivedTasks = project.archivedTasks || [];

  const activeTask =
    project.plannedTasks.find((task) => task.id === activeId) ||
    project.archivedTasks.find((task) => task.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        screenReaderInstructions: {
          draggable: t("tasks:board.keyboardInstructions"),
        },
      }}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      modifiers={[snapCenterToCursor]}
    >
      <div className="w-full h-full overflow-auto bg-muted/20">
        <div className="divide-y divide-border/50">
          <BacklogSection
            sectionId="planned"
            title={t("tasks:backlog.sections.planned")}
            icon={Clock}
            tasks={plannedTasks}
            isExpanded={expandedSections.planned}
            showDropIndicator={activeId !== null && overColumnId === "planned"}
            onToggle={toggleSection}
            onAddTask={openPlannedTaskModal}
          />

          <BacklogSection
            sectionId="archived"
            title={t("tasks:backlog.sections.archived")}
            icon={Archive}
            tasks={archivedTasks}
            isExpanded={expandedSections.archived}
            showDropIndicator={activeId !== null && overColumnId === "archived"}
            onToggle={toggleSection}
          />
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
        projectId={project?.id}
        onClose={() => setIsTaskModalOpen(false)}
        status={activeColumn ?? "planned"}
      />

      <BacklogBulkToolbar />
    </DndContext>
  );
}

export default BacklogListView;
