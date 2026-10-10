import { useNavigate } from "@tanstack/react-router";
import { differenceInCalendarDays } from "date-fns";
import {
  ChevronDown,
  ChevronUp,
  History,
  Pencil,
  Play,
  Plus,
  Rocket,
  SquareCheckBig,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatDateShort } from "@/lib/format";
import { getPriorityIcon } from "@/lib/priority";
import { useReorderSprints } from "@/hooks/mutations/sprint/use-reorder-sprints";
import { useStartSprint } from "@/hooks/mutations/sprint/use-start-sprint";
import { useGetSprints } from "@/hooks/queries/sprint/use-get-sprints";
import useProjectStore from "@/store/project";
import { toast } from "@/lib/toast";
import type Sprint from "@/types/sprint";
import type Task from "@/types/task";
import CloseSprintDialog from "./close-sprint-dialog";
import SprintDialog from "./sprint-dialog";

type SprintPlanningViewProps = {
  projectId: string;
};

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

function SprintTaskRow({ task }: { task: Task }) {
  const navigate = useNavigate();
  const projectSlug = useProjectStore((state) => state.project?.slug);
  const projectColumns = useProjectStore((state) => state.project?.columns);
  const isDone =
    projectColumns?.some(
      (column) => column.isFinal && column.id === task.status,
    ) ?? false;

  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-3 py-1 text-left text-xs text-foreground/90 transition-colors hover:bg-accent/60 hover:text-foreground"
      onClick={() => navigate({ to: ".", search: { taskId: task.id } })}
    >
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">
        {getPriorityIcon(task.priority ?? "")}
      </span>
      {projectSlug && (
        <span className="shrink-0 font-mono text-muted-foreground">
          {projectSlug}-{task.number}
        </span>
      )}
      <span
        className={`truncate ${isDone ? "text-muted-foreground line-through" : ""}`}
      >
        {task.title}
      </span>
    </button>
  );
}

// Carried-over tasks may have been deleted since the sprint closed, so the
// frozen snapshot title is the fallback when no live task matches.
function CarriedOverTaskRow({ title }: { title: string }) {
  return (
    <span className="flex w-full items-center gap-2 rounded-md px-3 py-1 text-left text-xs text-muted-foreground">
      <span className="truncate">{title}</span>
    </span>
  );
}

// Jira-style sprint planning above the backlog: the single active sprint,
// the reorderable upcoming sprints, and the immutable closed history. Every
// sprint section lists its own tasks, so sprint work is planned in context.
export default function SprintPlanningView({
  projectId,
}: SprintPlanningViewProps) {
  const { t } = useTranslation();
  const { data: sprints = [] } = useGetSprints(projectId);
  const project = useProjectStore((state) => state.project);
  const { mutateAsync: startSprint, isPending: isStarting } =
    useStartSprint();
  const { mutateAsync: reorderSprints } = useReorderSprints();

  const [isSprintDialogOpen, setIsSprintDialogOpen] = useState(false);
  const [editedSprint, setEditedSprint] = useState<Sprint | null>(null);
  const [closingSprint, setClosingSprint] = useState<Sprint | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [expandedSprints, setExpandedSprints] = useState<
    Record<string, boolean>
  >({});

  const activeSprint = sprints.find((sprint) => sprint.status === "active");
  const futureSprints = sprints.filter((sprint) => sprint.status === "future");
  const closedSprints = sprints.filter(
    (sprint) => sprint.status === "closed",
  );

  // Sprint tasks live in the board columns and the planned backlog; archived
  // tasks stay out of the sprint sections.
  const sprintTasks = project
    ? [
        ...project.plannedTasks,
        ...project.columns.flatMap((column) => column.tasks),
      ]
    : [];

  const tasksForSprint = (sprintId: string) =>
    sprintTasks.filter((task) => task.sprintId === sprintId);

  const toggleSprintTasks = (sprintId: string) => {
    setExpandedSprints((prev) => ({ ...prev, [sprintId]: !prev[sprintId] }));
  };

  const renderSprintTaskList = (sprintId: string) => {
    const tasks = tasksForSprint(sprintId);
    if (tasks.length === 0) {
      return (
        <span className="px-3 py-1 text-xs text-muted-foreground">
          {t("tasks:sprints.noTasks")}
        </span>
      );
    }
    return tasks.map((task) => (
      <SprintTaskRow key={task.id} task={task} />
    ));
  };

  // The per-sprint report: planned work is what stayed plus what was moved
  // out, so the numbers stay true even after the carried-over tasks moved on.
  const renderSprintReport = (sprint: Sprint) => {
    const carriedOver = sprint.carryOverTasks ?? [];
    return (
      <span className="px-3 py-1 text-xs text-muted-foreground">
        {t("tasks:sprints.reportSummary", {
          planned: sprint.completedTaskCount + carriedOver.length,
          completed: sprint.completedTaskCount,
          carriedOver: carriedOver.length,
        })}
      </span>
    );
  };

  const renderCarriedOverList = (sprint: Sprint) => {
    const carriedOver = sprint.carryOverTasks ?? [];
    if (carriedOver.length === 0) {
      return null;
    }
    return (
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
    );
  };

  const handleStart = async (sprint: Sprint) => {
    try {
      await startSprint({ id: sprint.id, projectId });
      toast.success(
        t("tasks:sprints.startSuccess", { name: sprint.name }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:sprints.error", { defaultValue: "Sprint action failed" }),
      );
    }
  };

  const handleReorder = async (
    sprint: Sprint,
    direction: "up" | "down",
  ) => {
    const index = futureSprints.findIndex((item) => item.id === sprint.id);
    const swapWith =
      direction === "up" ? futureSprints[index - 1] : futureSprints[index + 1];
    if (!swapWith) return;

    try {
      await reorderSprints({
        projectId,
        sprints: [
          { id: sprint.id, position: swapWith.position },
          { id: swapWith.id, position: sprint.position },
        ],
      });
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

  const activeRange = activeSprint ? formatSprintRange(activeSprint, t) : null;
  const activeRemainingDays = activeSprint?.endDate
    ? differenceInCalendarDays(new Date(activeSprint.endDate), new Date())
    : null;
  const activeProgressPercent =
    activeSprint && activeSprint.taskCount > 0
      ? Math.round(
          (activeSprint.completedTaskCount / activeSprint.taskCount) * 100,
        )
      : null;

  return (
    <div className="border-b border-border/80 bg-card">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("tasks:sprints.title")}
          </span>
        </div>
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

      <div className="flex flex-col gap-2 px-4 pb-3">
        {activeSprint ? (
          <Collapsible
            open={expandedSprints[activeSprint.id] ?? false}
            onOpenChange={() => toggleSprintTasks(activeSprint.id)}
          >
            <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {activeSprint.name}
                    </span>
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                      {t("tasks:sprints.activeBadge")}
                    </span>
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {activeSprint.goal ?? activeRange ?? ""}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t("tasks:sprints.taskCounts", {
                      completed: activeSprint.completedTaskCount,
                      total: activeSprint.taskCount,
                    })}
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-6 px-2 text-xs"
                    onClick={() => setClosingSprint(activeSprint)}
                  >
                    <SquareCheckBig className="h-3 w-3 mr-1" />
                    {t("tasks:sprints.close")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title={t("tasks:sprints.edit")}
                    onClick={() => openEditDialog(activeSprint)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <CollapsibleTrigger
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                    title={t("tasks:sprints.toggleTasks")}
                  >
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${
                        expandedSprints[activeSprint.id] ? "rotate-180" : ""
                      }`}
                    />
                  </CollapsibleTrigger>
                </div>
              </div>
              {(activeRange ||
                activeRemainingDays !== null ||
                activeProgressPercent !== null) && (
                <div className="mt-2 flex items-center gap-3">
                  {activeRange && (
                    <span className="text-xs text-muted-foreground">
                      {activeRange}
                    </span>
                  )}
                  {activeRemainingDays !== null &&
                    activeRemainingDays > 0 && (
                      <span className="text-xs font-medium text-primary">
                        {t("tasks:sprints.daysRemaining", {
                          remaining: activeRemainingDays,
                        })}
                      </span>
                    )}
                  {activeRemainingDays === 0 && (
                    <span className="text-xs font-medium text-primary">
                      {t("tasks:sprints.endsToday")}
                    </span>
                  )}
                  {activeRemainingDays !== null && activeRemainingDays < 0 && (
                    <span className="text-xs font-medium text-destructive">
                      {t("tasks:sprints.daysOverdue", {
                        remaining: Math.abs(activeRemainingDays),
                      })}
                    </span>
                  )}
                  {activeProgressPercent !== null && (
                    <span className="ml-auto flex items-center gap-2">
                      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${activeProgressPercent}%` }}
                        />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {activeProgressPercent}%
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
            <CollapsibleContent>
              <div className="flex flex-col gap-0.5 pt-1 pl-2">
                {renderSprintTaskList(activeSprint.id)}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("tasks:sprints.noActive")}
          </p>
        )}

        {futureSprints.length > 0 && (
          <div className="flex flex-col gap-1">
            {futureSprints.map((sprint, index) => (
              <Collapsible
                key={sprint.id}
                open={expandedSprints[sprint.id] ?? false}
                onOpenChange={() => toggleSprintTasks(sprint.id)}
              >
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-1.5">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {sprint.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {sprint.goal ??
                        formatSprintRange(sprint, t) ??
                        t("tasks:sprints.upcoming")}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="mr-1 text-xs text-muted-foreground">
                      {t("tasks:sprints.taskCounts", {
                        completed: sprint.completedTaskCount,
                        total: sprint.taskCount,
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === 0}
                      title={t("tasks:sprints.moveUp")}
                      onClick={() => handleReorder(sprint, "up")}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === futureSprints.length - 1}
                      title={t("tasks:sprints.moveDown")}
                      onClick={() => handleReorder(sprint, "down")}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
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
                    <CollapsibleTrigger
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                      title={t("tasks:sprints.toggleTasks")}
                    >
                      <ChevronDown
                        className={`h-3 w-3 transition-transform ${
                          expandedSprints[sprint.id] ? "rotate-180" : ""
                        }`}
                      />
                    </CollapsibleTrigger>
                  </div>
                </div>
                <CollapsibleContent>
                  <div className="flex flex-col gap-0.5 pt-1 pl-2">
                    {renderSprintTaskList(sprint.id)}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}

        {closedSprints.length > 0 && (
          <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground hover:text-foreground">
              <History className="h-3.5 w-3.5" />
              {t("tasks:sprints.history", { count: closedSprints.length })}
              <ChevronDown
                className={`h-3 w-3 transition-transform ${isHistoryOpen ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-col gap-1 pt-1">
                {[...closedSprints].reverse().map((sprint) => (
                  <Collapsible
                    key={sprint.id}
                    open={expandedSprints[sprint.id] ?? false}
                    onOpenChange={() => toggleSprintTasks(sprint.id)}
                  >
                    <div className="flex items-center justify-between gap-2 rounded-md px-3 py-1 text-xs text-muted-foreground">
                      <CollapsibleTrigger className="flex min-w-0 items-center gap-1.5">
                        <ChevronDown
                          className={`h-3 w-3 shrink-0 transition-transform ${
                            expandedSprints[sprint.id] ? "rotate-180" : ""
                          }`}
                        />
                        <span className="truncate font-medium">
                          {sprint.name}
                        </span>
                      </CollapsibleTrigger>
                      <span>
                        {t("tasks:sprints.completedCount", {
                          count: sprint.completedTaskCount,
                        })}
                      </span>
                    </div>
                    <CollapsibleContent>
                      <div className="flex flex-col gap-0.5 pt-1 pl-2">
                        {renderSprintReport(sprint)}
                        {renderSprintTaskList(sprint.id)}
                        {renderCarriedOverList(sprint)}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <SprintDialog
        projectId={projectId}
        sprint={editedSprint}
        open={isSprintDialogOpen}
        onOpenChange={setIsSprintDialogOpen}
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
    </div>
  );
}
