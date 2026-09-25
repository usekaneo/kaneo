import { useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  Link2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
} from "@/components/ui/command";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import useCreateTaskRelation from "@/hooks/mutations/task-relation/use-create-task-relation";
import useDeleteTaskRelation from "@/hooks/mutations/task-relation/use-delete-task-relation";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGlobalSearch from "@/hooks/queries/search/use-global-search";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getColumnIcon } from "@/lib/column";
import { getInitials } from "@/lib/get-initials";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";
import SubtaskAssigneePopover from "./subtask-assignee-popover";
import SubtaskStatusPopover from "./subtask-status-popover";
import {
  buildCrossProjectTaskGroups,
  isOtherProjectItem,
  type PickerTaskGroup as TaskGroup,
  type PickerTaskItem as TaskItem,
} from "./task-relations-cross-project";

type TaskRelationsProps = {
  taskId: string;
  projectId: string;
  workspaceId: string;
};

// A workspace can hold far more tasks than any one project, so the
// cross-project half of the picker is server-searched (via the existing
// global search endpoint, scoped to this workspace) rather than loaded
// client-side. This threshold keeps that request off single keystrokes.
const CROSS_PROJECT_SEARCH_MIN_CHARS = 2;

export default function TaskRelations({
  taskId,
  projectId,
  workspaceId,
}: TaskRelationsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRelationType, setSelectedRelationType] = useState<
    "blocks" | "related"
  >("related");

  const { data: relations = [] } = useGetTaskRelations(taskId);
  const { data: projectData } = useGetTasks(projectId);
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { data: workspace } = useActiveWorkspace();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(
    workspace?.id ?? "",
  );
  const createRelation = useCreateTaskRelation();
  const deleteRelation = useDeleteTaskRelation(taskId);
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  const trimmedSearchQuery = searchQuery.trim();
  const { data: crossProjectSearch } = useGlobalSearch({
    q:
      trimmedSearchQuery.length >= CROSS_PROJECT_SEARCH_MIN_CHARS
        ? trimmedSearchQuery
        : "",
    type: "tasks",
    workspaceId,
    // Excluded server-side so a query that matches 20+ tasks in the current
    // project doesn't crowd out the other-project matches this group exists
    // to surface (the current project already has its own group above).
    excludeProjectId: projectId,
    limit: 20,
  });

  useEffect(() => {
    if (!commandOpen) {
      setSearchQuery("");
    }
  }, [commandOpen]);

  // Memoized so its reference only changes when `relations` actually does —
  // otherwise every render would hand groupedRelations and
  // existingRelatedTaskIds a fresh array and defeat their own memoization.
  const nonSubtaskRelations = useMemo(
    () => relations.filter((rel) => rel.relationType !== "subtask"),
    [relations],
  );

  const groupedRelations = useMemo(() => {
    const groups: Record<
      string,
      Array<{
        id: string;
        relationType: string;
        task: NonNullable<(typeof nonSubtaskRelations)[number]["sourceTask"]>;
      }>
    > = {};

    for (const rel of nonSubtaskRelations) {
      const isSource = rel.sourceTaskId === taskId;
      const linkedTask = isSource ? rel.targetTask : rel.sourceTask;
      if (!linkedTask) continue;

      // "blocks" is directional: when the current task is the target it is the
      // one being blocked, so group it under a distinct "blocked_by" key.
      const type =
        rel.relationType === "blocks" && !isSource
          ? "blocked_by"
          : rel.relationType;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push({
        id: rel.id,
        relationType: rel.relationType,
        task: linkedTask,
      });
    }

    return groups;
  }, [nonSubtaskRelations, taskId]);

  const existingRelatedTaskIds = useMemo(() => {
    const ids = new Set(
      nonSubtaskRelations.flatMap((rel) => [
        rel.sourceTaskId,
        rel.targetTaskId,
      ]),
    );
    ids.add(taskId);
    return ids;
  }, [nonSubtaskRelations, taskId]);

  const allTasks = useMemo(() => {
    if (!projectData) return [];
    const tasks: TaskItem[] = [];

    if ("columns" in projectData && Array.isArray(projectData.columns)) {
      for (const col of projectData.columns as Array<{
        tasks: TaskItem[];
      }>) {
        if (col.tasks) {
          for (const t of col.tasks) {
            tasks.push(t);
          }
        }
      }
    }

    return tasks;
  }, [projectData]);

  const finalStatusSlugs = useMemo(() => {
    if (!projectData) return new Set<string>();
    if ("columns" in projectData && Array.isArray(projectData.columns)) {
      return new Set(
        (projectData.columns as Array<{ id: string; isFinal?: boolean }>)
          .filter((col) => col.isFinal)
          .map((col) => col.id),
      );
    }
    return new Set<string>();
  }, [projectData]);

  const columnIconBySlug = useMemo(() => {
    const icons = new Map<string, string | null | undefined>();
    if (!projectData) return icons;
    if ("columns" in projectData && Array.isArray(projectData.columns)) {
      for (const col of projectData.columns as Array<{
        id: string;
        icon?: string | null;
      }>) {
        icons.set(col.id, col.icon);
      }
    }
    return icons;
  }, [projectData]);

  const filteredTasks = allTasks.filter(
    (t) => !existingRelatedTaskIds.has(t.id),
  );

  const crossProjectGroups = useMemo<TaskGroup[]>(() => {
    const results = crossProjectSearch?.results ?? [];
    if (results.length === 0) return [];

    return buildCrossProjectTaskGroups({
      results,
      currentProjectId: projectId,
      excludedTaskIds: existingRelatedTaskIds,
      labelForProject: (projectName) =>
        t("tasks:relations.tasksInOtherProject", { project: projectName }),
    });
  }, [crossProjectSearch, projectId, existingRelatedTaskIds, t]);

  const commandGroups = useMemo<TaskGroup[]>(() => {
    return [
      {
        value: "tasks",
        label: t("tasks:relations.tasksInProject"),
        items: filteredTasks,
      },
      ...crossProjectGroups,
    ];
  }, [filteredTasks, crossProjectGroups, t]);

  const handleLinkTask = async (targetTaskId: string) => {
    try {
      await createRelation.mutateAsync({
        sourceTaskId: taskId,
        targetTaskId,
        relationType: selectedRelationType,
      });
      setCommandOpen(false);
      setSearchQuery("");
    } catch {
      toast.error(t("tasks:relations.linkError"));
    }
  };

  const handleRemoveRelation = (relationId: string) => {
    deleteRelation.mutate(relationId);
  };

  // Related tasks can live in another project (cross-project linking), so the
  // route must use that task's own project id rather than the project this
  // panel is rendered for, or a cross-project item opens the wrong project
  // context (or 404s).
  const handleNavigateToTask = (
    linkedTaskId: string,
    linkedTaskProjectId: string,
  ) => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: {
        workspaceId,
        projectId: linkedTaskProjectId,
        taskId: linkedTaskId,
      },
    });
  };

  const getAssignee = (userId: string | null) => {
    if (!userId || !workspaceUsers?.members) return null;
    return workspaceUsers.members.find((member) => member.userId === userId);
  };

  const buildTaskObject = (item: {
    task: NonNullable<(typeof nonSubtaskRelations)[number]["sourceTask"]>;
  }): Task => ({
    id: item.task.id,
    title: item.task.title,
    number: item.task.number,
    description: null,
    status: item.task.status,
    priority: item.task.priority,
    startDate: null,
    dueDate: null,
    progress: 0,
    isMilestone: false,
    baselineStartDate: null,
    baselineDueDate: null,
    position: null,
    createdAt: "",
    updatedAt: "",
    userId: item.task.userId,
    assigneeId: item.task.userId,
    assigneeName: item.task.assigneeName,
    assigneeImage: "",
    projectId: item.task.projectId,
  });

  const totalCount = nonSubtaskRelations.length;

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {isOpen ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
                <span>{t("tasks:relations.title")}</span>
              </button>
            </CollapsibleTrigger>
            {totalCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {totalCount}
              </span>
            )}
          </div>
          {canEdit && (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => setCommandOpen(true)}
            >
              <Plus className="size-3.5" />
            </Button>
          )}
        </div>

        <CollapsibleContent>
          {Object.entries(groupedRelations).map(([type, items]) => (
            <div key={type} className="mt-1.5">
              <span className="text-[11px] text-muted-foreground/70 px-2">
                {t(`tasks:relations.types.${type}`, {
                  defaultValue: type.replace(/_/g, " "),
                })}
              </span>
              <div className="flex flex-col mt-0.5">
                {items.map((item) => {
                  const assignee = getAssignee(item.task.userId);
                  const taskObj = buildTaskObject(item);
                  // Column ids/slugs and "final" status are specific to one
                  // project's board, so a related task from another project
                  // must not be rendered with the current project's column
                  // metadata (its status id may not even exist there).
                  const isOtherProject = isOtherProjectItem(
                    item.task,
                    projectId,
                  );
                  const statusIcon = getColumnIcon(
                    item.task.status,
                    !isOtherProject && finalStatusSlugs.has(item.task.status),
                    isOtherProject
                      ? undefined
                      : columnIconBySlug.get(item.task.status),
                  );
                  const isFinalStatus =
                    !isOtherProject && finalStatusSlugs.has(item.task.status);

                  return (
                    <ContextMenu key={item.id}>
                      <ContextMenuTrigger asChild>
                        <div className="group flex items-center gap-2 py-1 px-2 rounded-md hover:bg-accent/50 transition-colors cursor-default">
                          {isOtherProject ? (
                            // The status columns belong to the other project's
                            // board, which isn't loaded here; rather than apply
                            // this project's columns to a task that lives
                            // elsewhere (and risk writing an invalid status),
                            // the control is read-only for cross-project items.
                            // A non-interactive `span` (not a `button`, which
                            // would be a keyboard focus-stop with no action)
                            // — `aria-label` stands in for the visible text a
                            // sighted user gets from the native `title`
                            // tooltip.
                            <span
                              title={t(
                                "tasks:relations.crossProjectStatusReadOnly",
                              )}
                              aria-label={t(
                                "tasks:relations.crossProjectStatusReadOnly",
                              )}
                              className="shrink-0 flex items-center justify-center rounded p-0.5 cursor-default [&_svg]:text-muted-foreground"
                            >
                              {statusIcon}
                            </span>
                          ) : (
                            <SubtaskStatusPopover
                              tasks={[taskObj]}
                              projectId={projectId}
                            >
                              <button
                                type="button"
                                className="shrink-0 flex items-center justify-center rounded p-0.5 transition-colors outline-none [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground"
                              >
                                {statusIcon}
                              </button>
                            </SubtaskStatusPopover>
                          )}

                          <button
                            type="button"
                            className="flex-1 min-w-0 text-left outline-none"
                            onClick={() =>
                              handleNavigateToTask(
                                item.task.id,
                                item.task.projectId,
                              )
                            }
                          >
                            <span
                              className={`text-sm truncate block ${isFinalStatus ? "line-through text-muted-foreground" : "text-foreground/90"}`}
                            >
                              {item.task.title}
                            </span>
                          </button>

                          <SubtaskAssigneePopover
                            tasks={[taskObj]}
                            workspaceId={workspaceId}
                          >
                            <button
                              type="button"
                              className="shrink-0 flex items-center justify-center rounded p-0.5 transition-colors outline-none"
                            >
                              {item.task.userId && assignee ? (
                                <Avatar className="h-5 w-5">
                                  <AvatarImage
                                    src={assignee?.user?.image ?? ""}
                                    alt={assignee?.user?.name || ""}
                                  />
                                  <AvatarFallback className="text-[9px] font-medium border border-border/30">
                                    {getInitials(assignee?.user?.name)}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <div
                                  className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-border/70"
                                  title={t("tasks:popover.assignee.unassigned")}
                                >
                                  <span className="text-[9px] font-medium text-muted-foreground">
                                    ?
                                  </span>
                                </div>
                              )}
                            </button>
                          </SubtaskAssigneePopover>
                        </div>
                      </ContextMenuTrigger>

                      <ContextMenuContent className="w-40">
                        <ContextMenuItem
                          onClick={() =>
                            handleNavigateToTask(
                              item.task.id,
                              item.task.projectId,
                            )
                          }
                        >
                          <span>{t("tasks:relations.openTask")}</span>
                        </ContextMenuItem>
                        {canEdit && (
                          <>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              className="text-destructive"
                              onClick={() => handleRemoveRelation(item.id)}
                            >
                              <span>{t("tasks:relations.removeRelation")}</span>
                            </ContextMenuItem>
                          </>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            </div>
          ))}

          {totalCount === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1">
              {t("tasks:relations.empty")}
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandDialogPopup>
          <Command items={commandGroups}>
            <CommandInput
              placeholder={t("tasks:relations.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <CommandPanel>
              <CommandEmpty>
                <div className="text-center py-6">
                  <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {t("tasks:relations.noTasksFound")}
                  </p>
                </div>
              </CommandEmpty>
              <CommandList>
                {(group: TaskGroup, groupIndex: number) => (
                  <Fragment key={group.value}>
                    <CommandGroup items={group.items}>
                      <CommandGroupLabel>{group.label}</CommandGroupLabel>
                      <CommandCollection>
                        {(item: TaskItem) => {
                          // Cross-project items carry their own project slug;
                          // same-project items fall back to the current project.
                          const slug = item.projectSlug ?? project?.slug;
                          const isOtherProject = isOtherProjectItem(
                            item,
                            projectId,
                          );
                          return (
                            <CommandItem
                              key={item.id}
                              value={`${slug}-${item.number} ${item.title} ${item.description ?? ""}`}
                              onClick={() => handleLinkTask(item.id)}
                              className="flex items-center gap-3 py-2"
                            >
                              {getColumnIcon(
                                item.status,
                                false,
                                isOtherProject
                                  ? undefined
                                  : columnIconBySlug.get(item.status),
                              )}
                              <span className="text-xs text-muted-foreground shrink-0 font-mono">
                                {slug}-{item.number}
                              </span>
                              <span className="text-sm truncate flex-1">
                                {item.title}
                              </span>
                            </CommandItem>
                          );
                        }}
                      </CommandCollection>
                    </CommandGroup>
                    {groupIndex < commandGroups.length - 1 && (
                      <CommandSeparator />
                    )}
                  </Fragment>
                )}
              </CommandList>
            </CommandPanel>
            <CommandFooter>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${selectedRelationType === "related" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setSelectedRelationType("related")}
                >
                  <Link2 className="size-3" />
                  {t("tasks:relations.related")}
                </button>
                <button
                  type="button"
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${selectedRelationType === "blocks" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setSelectedRelationType("blocks")}
                >
                  <X className="size-3" />
                  {t("tasks:relations.blocks")}
                </button>
              </div>
              <span className="text-muted-foreground/60">
                {t("tasks:relations.selectTask")}
              </span>
            </CommandFooter>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>
    </>
  );
}
