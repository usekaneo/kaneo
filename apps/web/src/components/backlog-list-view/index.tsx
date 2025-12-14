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
import { produce } from "immer";
import { Archive, ChevronRight, Clock, Flag, Plus } from "lucide-react";
import { useState } from "react";
import { priorityColorsTaskCard } from "@/constants/priority-colors";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { cn } from "@/lib/cn";
import toKebabCase from "@/lib/to-kebab-case";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import CreateTaskModal from "../shared/modals/create-task-modal";
import BacklogTaskRow from "./backlog-task-row";

type BacklogListViewProps = {
  project?: ProjectWithTasks;
};

function BacklogListView({ project }: BacklogListViewProps) {
  const { mutate: updateTask } = useUpdateTask();
  const { setProject } = useProjectStore();
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

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverColumnId(null);

    if (!over || !project) return;

    const activeTaskId = active.id.toString();
    const overId = over.id.toString();

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
            position: index + 1,
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
            position: index + 1,
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

  function BacklogSection({
    sectionId,
    title,
    icon: IconComponent,
    tasks,
    showAddButton = false,
  }: {
    sectionId: string;
    title: string;
    icon: typeof Clock;
    tasks: Task[];
    showAddButton?: boolean;
  }) {
    const { setNodeRef } = useDroppable({
      id: sectionId,
      data: {
        type: "column",
        column: { id: sectionId, name: title },
      },
    });

    const showDropIndicator = activeId && overColumnId === sectionId;

    return (
      <div
        className={cn(
          "border-b border-zinc-200 dark:border-zinc-800/50 transition-all duration-200 overflow-auto",
          showDropIndicator &&
            "border-l-4 border-l-indigo-500 dark:border-l-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/10",
        )}
      >
        <div className="flex items-center justify-between py-2 px-4 bg-zinc-100/60 dark:bg-zinc-800/20 border-b border-zinc-200/50 dark:border-zinc-800/30">
          <button
            type="button"
            onClick={() => toggleSection(sectionId)}
            className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ChevronRight
              className={cn(
                "w-3 h-3 transition-transform",
                expandedSections[sectionId] && "rotate-90",
              )}
            />
            <div className="flex items-center gap-2 h-4">
              <IconComponent className="w-4 h-4 flex-shrink-0 text-zinc-500 dark:text-zinc-400" />
              <div className="flex items-center gap-1">
                <span className="mt-1 mr-1">{title}</span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {tasks.length}
                </span>
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1">
            {showAddButton && (
              <button
                type="button"
                onClick={() => {
                  setIsTaskModalOpen(true);
                  setActiveColumn("planned");
                }}
                className="p-1 hover:bg-zinc-200/70 dark:hover:bg-zinc-700 rounded text-zinc-600 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                title="Add task"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {expandedSections[sectionId] && (
          <div ref={setNodeRef} className="bg-white dark:bg-transparent">
            <SortableContext
              items={tasks}
              strategy={verticalListSortingStrategy}
            >
              {tasks.map((task) => (
                <BacklogTaskRow key={task.id} task={task} />
              ))}
            </SortableContext>

            {tasks.length === 0 && (
              <div className="py-6 px-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
                No {title.toLowerCase()} tasks
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

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
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      modifiers={[snapCenterToCursor]}
    >
      <div className="w-full h-full overflow-auto bg-zinc-50/30 dark:bg-transparent">
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
          <BacklogSection
            sectionId="planned"
            title="Planned"
            icon={Clock}
            tasks={plannedTasks}
            showAddButton={true}
          />

          <BacklogSection
            sectionId="archived"
            title="Archived"
            icon={Archive}
            tasks={archivedTasks}
          />
        </div>
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-2 max-w-[200px] cursor-grabbing">
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
                  <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                    {project?.slug}-{activeTask.number}
                  </span>
                  <span className="text-xs text-zinc-900 dark:text-zinc-100 truncate">
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
        onClose={() => setIsTaskModalOpen(false)}
        status={toKebabCase(activeColumn ?? "planned")}
      />
    </DndContext>
  );
}

export default BacklogListView;
