import { useNavigate } from "@tanstack/react-router";
import { Ban, Link2, Search, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  buildRelationLink,
  findParentRelation,
  unpickableTaskIds,
} from "./task-relation-link";
import {
  type RelationPickerMode,
  useRelationPickerStore,
} from "./task-relation-picker-store";
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
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getColumnIcon } from "@/lib/column";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";
import { ReferenceAssigneeButton } from "./sections/reference-assignee-button";
import { ReferenceStatusButton } from "./sections/reference-status-button";
import { type RelationKind, RelationTag } from "./sections/relation-tag";
import { SectionAddButton } from "./sections/section-add-button";
import { SectionHeader } from "./sections/section-header";
import { TaskReferenceRow } from "./sections/task-reference-row";
import { useProjectSlugs } from "./sections/use-project-slugs";
import SubtaskStatusPopover from "./subtask-status-popover";

const relationOrder: Record<RelationKind, number> = {
  blocked_by: 0,
  blocks: 1,
  related: 2,
};

type TaskRelationsProps = {
  taskId: string;
  projectId: string;
  workspaceId: string;
};

type TaskItem = {
  id: string;
  title: string;
  number: number | null;
  status: string;
};

type TaskGroup = {
  value: string;
  label: string;
  items: TaskItem[];
};

export default function TaskRelations({
  taskId,
  projectId,
  workspaceId,
}: TaskRelationsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [commandOpen, setCommandOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRelationType, setSelectedRelationType] =
    useState<RelationPickerMode>("related");
  const relationRequest = useRelationPickerStore((state) => state.request);
  const clearRelationRequest = useRelationPickerStore((state) => state.clear);

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
  const displayIdOf = useProjectSlugs(workspaceId);

  useEffect(() => {
    if (!relationRequest || relationRequest.taskId !== taskId) return;
    clearRelationRequest();
    if (!canEdit) return;
    setSelectedRelationType(relationRequest.mode);
    setCommandOpen(true);
  }, [relationRequest, taskId, canEdit, clearRelationRequest]);

  useEffect(() => {
    if (!commandOpen) {
      setSearchQuery("");
    }
  }, [commandOpen]);

  const nonSubtaskRelations = relations.filter(
    (rel) => rel.relationType !== "subtask",
  );

  const linkedRelations = nonSubtaskRelations
    .flatMap((rel) => {
      const isSource = rel.sourceTaskId === taskId;
      const linkedTask = isSource ? rel.targetTask : rel.sourceTask;
      if (!linkedTask) return [];
      const kind: RelationKind =
        rel.relationType === "blocks"
          ? isSource
            ? "blocks"
            : "blocked_by"
          : "related";
      return [{ id: rel.id, kind, task: linkedTask }];
    })
    .sort((a, b) => relationOrder[a.kind] - relationOrder[b.kind]);

  const existingRelatedTaskIds = unpickableTaskIds(
    selectedRelationType,
    taskId,
    relations,
  );

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

  const commandGroups = useMemo<TaskGroup[]>(() => {
    return [
      {
        value: "tasks",
        label: t("tasks:relations.tasksInProject"),
        items: filteredTasks,
      },
    ];
  }, [filteredTasks, t]);

  const handleLinkTask = async (pickedTaskId: string) => {
    const previousParent =
      selectedRelationType === "parent"
        ? findParentRelation(taskId, relations)
        : undefined;
    try {
      await createRelation.mutateAsync(
        buildRelationLink(selectedRelationType, taskId, pickedTaskId),
      );
      if (previousParent) {
        await deleteRelation.mutateAsync(previousParent.id);
      }
      setCommandOpen(false);
      setSearchQuery("");
    } catch {
      toast.error(t("tasks:relations.linkError"));
    }
  };

  const handleRemoveRelation = (relationId: string) => {
    deleteRelation.mutate(relationId);
  };

  const handleNavigateToTask = (linkedTaskId: string) => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: { workspaceId, projectId, taskId: linkedTaskId },
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
      <section className="flex flex-col gap-1">
        <SectionHeader
          title={t("tasks:relations.title")}
          meta={
            totalCount > 0 && (
              <span className="text-muted-foreground text-xs tabular-nums">
                {totalCount}
              </span>
            )
          }
          action={
            canEdit && (
              <SectionAddButton
                aria-label={`${t("tasks:subtasks.addAction")} ${t("tasks:relations.title")}`}
                onClick={() => setCommandOpen(true)}
              />
            )
          }
        />

        <div className="flex flex-col">
          {linkedRelations.map((item) => {
            const assignee = getAssignee(item.task.userId);
            const taskObj = buildTaskObject(item);
            const isFinal = finalStatusSlugs.has(item.task.status);

            return (
              <ContextMenu key={item.id}>
                <ContextMenuTrigger asChild>
                  <TaskReferenceRow
                    status={
                      <SubtaskStatusPopover
                        tasks={[taskObj]}
                        projectId={item.task.projectId}
                      >
                        <ReferenceStatusButton
                          aria-label={t("tasks:status.label")}
                        >
                          {getColumnIcon(
                            item.task.status,
                            isFinal,
                            columnIconBySlug.get(item.task.status),
                          )}
                        </ReferenceStatusButton>
                      </SubtaskStatusPopover>
                    }
                    displayId={displayIdOf(
                      item.task.projectId,
                      item.task.number,
                    )}
                    title={item.task.title}
                    done={isFinal}
                    onOpen={() => handleNavigateToTask(item.task.id)}
                    tag={<RelationTag kind={item.kind} />}
                    assignee={
                      <ReferenceAssigneeButton
                        tasks={[taskObj]}
                        workspaceId={workspaceId}
                        name={assignee?.user?.name ?? item.task.assigneeName}
                        image={assignee?.user?.image}
                      />
                    }
                  />
                </ContextMenuTrigger>

                <ContextMenuContent className="w-40">
                  <ContextMenuItem
                    onClick={() => handleNavigateToTask(item.task.id)}
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

          {totalCount === 0 && (
            <p className="px-2 py-1 text-muted-foreground text-xs">
              {t("tasks:relations.empty")}
            </p>
          )}
        </div>
      </section>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandDialogPopup>
          <Command items={commandGroups}>
            <CommandInput
              placeholder={
                selectedRelationType === "parent"
                  ? t("tasks:relations.parentPlaceholder")
                  : t("tasks:relations.searchPlaceholder")
              }
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
                        {(item: TaskItem) => (
                          <CommandItem
                            key={item.id}
                            value={`${project?.slug}-${item.number} ${item.title}`}
                            onClick={() => handleLinkTask(item.id)}
                            className="flex items-center gap-3 py-2"
                          >
                            {getColumnIcon(
                              item.status,
                              false,
                              columnIconBySlug.get(item.status),
                            )}
                            <span className="text-xs text-muted-foreground shrink-0 font-mono">
                              {project?.slug}-{item.number}
                            </span>
                            <span className="text-sm truncate flex-1">
                              {item.title}
                            </span>
                          </CommandItem>
                        )}
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
              <div
                className={`flex items-center gap-3 ${selectedRelationType === "parent" ? "hidden" : ""}`}
              >
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
                <button
                  type="button"
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${selectedRelationType === "blockedBy" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setSelectedRelationType("blockedBy")}
                >
                  <Ban className="size-3" />
                  {t("tasks:relations.blockedBy")}
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
