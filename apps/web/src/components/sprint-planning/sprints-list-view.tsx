import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { differenceInCalendarDays } from "date-fns";
import {
  ChevronDown,
  Inbox,
  Pencil,
  Play,
  Plus,
  Rocket,
  SquareCheckBig,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import BulkToolbar from "@/components/bulk-selection/bulk-toolbar";
import { useBulkRequestStore } from "@/components/bulk-selection/bulk-request-store";
import { AlertDialogCreateHandle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import TaskDeleteDialog from "@/components/task/task-delete-dialog";
import { useUpdateTaskSprint } from "@/hooks/mutations/sprint/use-update-task-sprint";
import { useStartSprint } from "@/hooks/mutations/sprint/use-start-sprint";
import { useBulkOperations } from "@/hooks/mutations/task/use-bulk-operations";
import { useGetSprints } from "@/hooks/queries/sprint/use-get-sprints";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format";
import { toast } from "@/lib/toast";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import type Sprint from "@/types/sprint";
import { CarriedOverTaskRow, SprintTaskRow } from "./sprint-planning-view";
import { SprintTaskItem } from "./sprint-task-row";
import CloseSprintDialog from "./close-sprint-dialog";
import SprintDialog from "./sprint-dialog";

type SprintsListViewProps = {
  projectId: string;
};

const BACKLOG_DROPPABLE_ID = "backlog";

function formatSprintRange(sprint: Sprint, t: (key: string) => string) {
  if (!sprint.startDate && !sprint.endDate) {
    return null;
  }
  const start = sprint.startDate
    ? formatDateShort(sprint.startDate)
    : t("tasks:sprints.unscheduled");
  const end = sprint.endDate
    ? formatDateShort(sprint.endDate)
    : t("tasks:sprints.unscheduled");
  return `${start} – ${end}`;
}

// A sprint block (or the backlog) that tasks can be dragged onto.
function SprintDropSection({
  id,
  disabled = false,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg transition-colors",
        isOver && !disabled && "outline-2 outline-offset-2 outline-primary/40",
      )}
    >
      {children}
    </div>
  );
}

// The full sprint history as one collapsible list: the backlog, every sprint
// of the project, each expanding to the issues assigned to it, closed ones
// included. Sprint tasks can be dragged between sprints or the backlog, and
// the row menus (three-dot or right click) edit single tasks or the whole
// multi selection.
export default function SprintsListView({ projectId }: SprintsListViewProps) {
  const { t } = useTranslation();
  const { data: sprints = [] } = useGetSprints(projectId);
  const project = useProjectStore((state) => state.project);
  const { mutateAsync: startSprint, isPending: isStarting } = useStartSprint();
  const { mutateAsync: updateTaskSprint } = useUpdateTaskSprint();
  const operations = useBulkOperations();

  const [isSprintDialogOpen, setIsSprintDialogOpen] = useState(false);
  const [editedSprint, setEditedSprint] = useState<Sprint | null>(null);
  const [closingSprint, setClosingSprint] = useState<Sprint | null>(null);
  const [expandedSprints, setExpandedSprints] = useState<
    Record<string, boolean>
  >({});
  const [isBacklogOpen, setIsBacklogOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<{
    taskId: string;
    count: number;
    title: string;
  } | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [deleteHandle] = useState(() => AlertDialogCreateHandle());

  const selectedTaskIds = useBulkSelectionStore(
    (state) => state.selectedTaskIds,
  );
  const setAvailableTasks = useBulkSelectionStore(
    (state) => state.setAvailableTasks,
  );
  const clearSelection = useBulkSelectionStore((state) => state.clearSelection);
  const clearFocus = useBulkSelectionStore((state) => state.clearFocus);

  const activeSprint = sprints.find((sprint) => sprint.status === "active");
  const futureSprints = sprints.filter((sprint) => sprint.status === "future");
  const closedSprints = sprints.filter((sprint) => sprint.status === "closed");

  // Sprint tasks live in the board columns and the planned backlog; archived
  // tasks stay out of the sprint lists.
  const sprintTasks = useMemo(
    () =>
      project
        ? [
            ...project.plannedTasks,
            ...project.columns.flatMap((column) => column.tasks),
          ]
        : [],
    [project],
  );

  const tasksForSprint = (sprintId: string) =>
    sprintTasks.filter((task) => task.sprintId === sprintId);

  const backlogTasks = useMemo(
    () => sprintTasks.filter((task) => task.sprintId == null),
    [sprintTasks],
  );

  // The range the shift selection spans: active sprint first, then the
  // upcoming sprints, then the backlog.
  const orderedTaskIds = useMemo(() => {
    const ids: string[] = [];
    for (const sprint of [activeSprint, ...futureSprints]) {
      if (!sprint) continue;
      for (const task of tasksForSprint(sprint.id)) ids.push(task.id);
    }
    for (const task of backlogTasks) ids.push(task.id);
    return ids;
  }, [activeSprint, futureSprints, sprintTasks, backlogTasks]);

  useEffect(() => {
    setAvailableTasks(orderedTaskIds);
  }, [orderedTaskIds, setAvailableTasks]);

  useEffect(() => {
    clearFocus();
    return () => clearSelection();
  }, [clearFocus, clearSelection]);

  const isSprintExpanded = (sprint: Sprint) =>
    expandedSprints[sprint.id] ?? sprint.status === "active";

  const toggleSprintTasks = (sprint: Sprint) => {
    setExpandedSprints((prev) => ({
      ...prev,
      [sprint.id]: !isSprintExpanded(sprint),
    }));
  };

  const handleStart = async (sprint: Sprint) => {
    try {
      await startSprint({ id: sprint.id, projectId });
      toast.success(t("tasks:sprints.startSuccess", { name: sprint.name }));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:sprints.error", { defaultValue: "Sprint action failed" }),
      );
    }
  };

  const openEditDialog = (sprint: Sprint) => {
    setEditedSprint(sprint);
    setIsSprintDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditedSprint(null);
    setIsSprintDialogOpen(true);
  };

  // Single delete opens the confirm dialog; a multi selection hands over to
  // the bulk delete confirm of the bulk bar.
  const handleRequestDelete = (taskIds: string[]) => {
    if (taskIds.length === 1) {
      setDeleteTaskId(taskIds[0]);
      deleteHandle.open(null);
    } else {
      useBulkRequestStore.getState().send("delete", null);
    }
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 10 },
    }),
  );

  // The pointer decides which sprint block receives a drop; sections do not
  // overlap, so the innermost hit is unambiguous.
  const collisionDetection: CollisionDetection = (args) => {
    const within = pointerWithin(args);
    return within.length > 0 ? within : rectIntersection(args);
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const taskId = String(active.id);
    const count =
      selectedTaskIds.has(taskId) && selectedTaskIds.size > 1
        ? selectedTaskIds.size
        : 1;
    const title =
      sprintTasks.find((task) => task.id === taskId)?.title ?? taskId;
    setActiveDrag({ taskId, count, title });
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveDrag(null);
    if (!over) return;

    const targetSprintId =
      over.id === BACKLOG_DROPPABLE_ID ? null : String(over.id);
    const draggedId = String(active.id);
    const taskIds =
      selectedTaskIds.has(draggedId) && selectedTaskIds.size > 1
        ? Array.from(selectedTaskIds)
        : [draggedId];

    // Nothing to do when every task already belongs to the target sprint.
    const currentSprintOf = (id: string) =>
      sprintTasks.find((task) => task.id === id)?.sprintId;
    if (taskIds.every((id) => currentSprintOf(id) === targetSprintId)) return;

    try {
      if (taskIds.length === 1) {
        await updateTaskSprint({
          taskId: taskIds[0],
          projectId,
          sprintId: targetSprintId,
        });
      } else {
        await operations.bulkSprint({ taskIds, sprintId: targetSprintId });
        clearSelection();
      }
      toast.success(t("tasks:sprints.moveSuccess", { count: taskIds.length }));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:bulk.updateSprintError"),
      );
    }
  };

  const renderTaskList = (sprint: Sprint) => {
    const tasks = tasksForSprint(sprint.id);
    const carriedOver = sprint.carryOverTasks ?? [];
    // Closed sprints are history: their rows stay read-only and nothing can
    // be dragged into them.
    const isClosed = sprint.status === "closed";
    return (
      <div className="flex flex-col gap-0.5 pt-1 pl-2">
        {tasks.length === 0 && carriedOver.length === 0 ? (
          <span className="px-3 py-1 text-xs text-muted-foreground">
            {t("tasks:sprints.noTasks")}
          </span>
        ) : isClosed ? (
          tasks.map((task) => (
            <span
              key={task.id}
              title={t("tasks:sprints.closedLocked")}
              className="block"
            >
              <SprintTaskRow task={task} />
            </span>
          ))
        ) : (
          tasks.map((task) => (
            <SprintTaskItem
              key={task.id}
              task={task}
              projectId={projectId}
              onRequestDelete={handleRequestDelete}
            />
          ))
        )}
        {carriedOver.length > 0 && (
          <div className="flex flex-col gap-0.5 pt-1">
            <span className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("tasks:sprints.carriedOver")}
            </span>
            {carriedOver.map((snapshot) => {
              const liveTask = sprintTasks.find(
                (task) => task.id === snapshot.id,
              );
              return liveTask ? (
                <SprintTaskRow key={snapshot.id} task={liveTask} />
              ) : (
                <CarriedOverTaskRow key={snapshot.id} title={snapshot.title} />
              );
            })}
          </div>
        )}
        {sprint.status === "closed" && (
          <span className="px-3 py-1 text-xs text-muted-foreground">
            {t("tasks:sprints.reportSummary", {
              planned: sprint.completedTaskCount + carriedOver.length,
              completed: sprint.completedTaskCount,
              carriedOver: carriedOver.length,
            })}
          </span>
        )}
      </div>
    );
  };

  const renderSprint = (sprint: Sprint) => {
    const progressPercent =
      sprint.taskCount > 0
        ? Math.round((sprint.completedTaskCount / sprint.taskCount) * 100)
        : null;
    const remainingDays = sprint.endDate
      ? differenceInCalendarDays(new Date(sprint.endDate), new Date())
      : null;
    const isExpanded = isSprintExpanded(sprint);

    return (
      <Collapsible
        key={sprint.id}
        open={isExpanded}
        onOpenChange={() => toggleSprintTasks(sprint)}
      >
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-1.5">
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">
                {sprint.name}
              </span>
              {sprint.status === "active" && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                  {t("tasks:sprints.activeBadge")}
                </span>
              )}
            </div>
            <span className="truncate text-xs text-muted-foreground">
              {sprint.goal ?? formatSprintRange(sprint, t) ?? ""}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t("tasks:sprints.taskCounts", {
                completed: sprint.completedTaskCount,
                total: sprint.taskCount,
              })}
            </span>
            {progressPercent !== null && (
              <span className="hidden items-center gap-2 sm:flex">
                <span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${progressPercent}%` }}
                  />
                </span>
                <span className="text-xs text-muted-foreground">
                  {progressPercent}%
                </span>
              </span>
            )}
            {sprint.status === "active" && remainingDays !== null && (
              <span
                className={
                  remainingDays >= 0
                    ? "text-xs font-medium text-primary"
                    : "text-xs font-medium text-destructive"
                }
              >
                {remainingDays > 0 &&
                  t("tasks:sprints.daysRemaining", {
                    remaining: remainingDays,
                  })}
                {remainingDays === 0 && t("tasks:sprints.endsToday")}
                {remainingDays < 0 &&
                  t("tasks:sprints.daysOverdue", {
                    remaining: Math.abs(remainingDays),
                  })}
              </span>
            )}
            {sprint.status === "active" && (
              <Button
                variant="ghost"
                size="xs"
                className="h-6 px-2 text-xs"
                onClick={() => setClosingSprint(sprint)}
              >
                <SquareCheckBig className="h-3 w-3 mr-1" />
                {t("tasks:sprints.close")}
              </Button>
            )}
            {sprint.status === "future" && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title={t("tasks:sprints.edit")}
                  onClick={() => openEditDialog(sprint)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  className="h-6 px-2 text-xs"
                  disabled={isStarting}
                  onClick={() => handleStart(sprint)}
                >
                  <Play className="h-3 w-3 mr-1" />
                  {t("tasks:sprints.start")}
                </Button>
              </>
            )}
            {sprint.status === "active" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title={t("tasks:sprints.edit")}
                onClick={() => openEditDialog(sprint)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            <CollapsibleTrigger
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              title={t("tasks:sprints.toggleTasks")}
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent>{renderTaskList(sprint)}</CollapsibleContent>
      </Collapsible>
    );
  };

  const renderBacklog = () => (
    <SprintDropSection id={BACKLOG_DROPPABLE_ID}>
      <Collapsible open={isBacklogOpen} onOpenChange={setIsBacklogOpen}>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-1.5">
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2">
              <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate text-sm font-medium">
                {t("tasks:sprints.backlog")}
              </span>
            </div>
            <span className="truncate text-xs text-muted-foreground">
              {t("tasks:sprints.backlogDescription")}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {backlogTasks.length}
            </span>
            <CollapsibleTrigger
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              title={t("tasks:sprints.toggleTasks")}
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${
                  isBacklogOpen ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent>
          <div className="flex flex-col gap-0.5 pt-1 pl-2">
            {backlogTasks.length === 0 ? (
              <span className="px-3 py-1 text-xs text-muted-foreground">
                {t("tasks:sprints.backlogEmpty")}
              </span>
            ) : (
              backlogTasks.map((task) => (
                <SprintTaskItem
                  key={task.id}
                  task={task}
                  projectId={projectId}
                  draggable
                  onRequestDelete={handleRequestDelete}
                />
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </SprintDropSection>
  );

  const activeTask = activeDrag
    ? sprintTasks.find((task) => task.id === activeDrag.taskId)
    : null;

  const sprintBody = (
    <>
      <div className="flex items-center justify-between px-4 py-2">
        <h1 className="text-sm font-semibold">
          {t("tasks:sprints.viewHeading")}
        </h1>
        <Button
          variant="ghost"
          size="xs"
          className="h-6 px-2 text-xs"
          onClick={openCreateDialog}
        >
          <Plus className="h-3 w-3 mr-1" />
          {t("tasks:sprints.create")}
        </Button>
      </div>
      <div className="flex flex-col gap-2 px-4 pb-4">
        {activeSprint ? (
          <SprintDropSection id={activeSprint.id}>
            {renderSprint(activeSprint)}
          </SprintDropSection>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("tasks:sprints.noActive")}
          </p>
        )}
        {renderBacklog()}
        {futureSprints.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("tasks:sprints.upcoming")}
            </span>
            {futureSprints.map((sprint) => (
              <SprintDropSection key={sprint.id} id={sprint.id}>
                {renderSprint(sprint)}
              </SprintDropSection>
            ))}
          </div>
        )}
        {closedSprints.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("tasks:sprints.history", {
                count: closedSprints.length,
              })}
            </span>
            {closedSprints.map((sprint) => (
              <SprintDropSection key={sprint.id} id={sprint.id} disabled>
                {renderSprint(sprint)}
              </SprintDropSection>
            ))}
          </div>
        )}
      </div>
    </>
  );

  if (sprints.length === 0) {
    return (
      <>
        <div className="flex h-full items-center justify-center px-4 py-10">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Rocket />
              </EmptyMedia>
              <EmptyTitle>
                <h2>{t("tasks:sprints.viewEmptyTitle")}</h2>
              </EmptyTitle>
              <EmptyDescription>
                {t("tasks:sprints.viewEmptyDescription")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-1" />
                {t("tasks:sprints.create")}
              </Button>
            </EmptyContent>
          </Empty>
        </div>
        <SprintDialog
          open={isSprintDialogOpen}
          onOpenChange={setIsSprintDialogOpen}
          projectId={projectId}
          sprint={editedSprint}
        />
      </>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDrag(null)}
      >
        {sprintBody}
        <DragOverlay>
          {activeDrag && activeTask ? (
            <div className="max-w-72 truncate rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-lg">
              {activeDrag.count > 1
                ? t("tasks:bulk.selectedCount", { count: activeDrag.count })
                : activeDrag.title}
            </div>
          ) : null}
        </DragOverlay>
        <BulkToolbar />
      </DndContext>
      <SprintDialog
        open={isSprintDialogOpen}
        onOpenChange={setIsSprintDialogOpen}
        projectId={projectId}
        sprint={editedSprint}
      />
      {closingSprint && (
        <CloseSprintDialog
          sprint={closingSprint}
          futureSprints={futureSprints}
          open={Boolean(closingSprint)}
          onOpenChange={(open) => {
            if (!open) setClosingSprint(null);
          }}
        />
      )}
      {deleteTaskId && (
        <TaskDeleteDialog
          handle={deleteHandle}
          taskId={deleteTaskId}
          onDeleted={() => setDeleteTaskId(null)}
          shortcutEnabled={false}
        />
      )}
    </>
  );
}
