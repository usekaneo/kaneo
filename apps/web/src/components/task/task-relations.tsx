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
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { getColumnIcon } from "@/lib/column";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";
import SubtaskAssigneePopover from "./subtask-assignee-popover";
import SubtaskStatusPopover from "./subtask-status-popover";

type TaskRelationsProps = {
  taskId: string;
  projectId: string;
  workspaceId: string;
};

const relationTypeLabels: Record<string, string> = {
  blocks: "blocks",
  related: "relates to",
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

  useEffect(() => {
    if (!commandOpen) {
      setSearchQuery("");
    }
  }, [commandOpen]);

  const nonSubtaskRelations = relations.filter(
    (rel) => rel.relationType !== "subtask",
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

      const type = rel.relationType;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push({
        id: rel.id,
        relationType: type,
        task: linkedTask,
      });
    }

    return groups;
  }, [nonSubtaskRelations, taskId]);

  const existingRelatedTaskIds = new Set(
    nonSubtaskRelations.flatMap((rel) => [rel.sourceTaskId, rel.targetTaskId]),
  );
  existingRelatedTaskIds.add(taskId);

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

  const filteredTasks = allTasks.filter(
    (t) => !existingRelatedTaskIds.has(t.id),
  );

  const commandGroups = useMemo<TaskGroup[]>(() => {
    return [
      {
        value: "tasks",
        label: "Tasks in project",
        items: filteredTasks,
      },
    ];
  }, [filteredTasks]);

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
      toast.error("Failed to link task");
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
    dueDate: null,
    position: null,
    createdAt: "",
    userId: item.task.userId,
    assigneeId: item.task.userId,
    assigneeName: item.task.assigneeName,
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
                <span>Relations</span>
              </button>
            </CollapsibleTrigger>
            {totalCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {totalCount}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => setCommandOpen(true)}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>

        <CollapsibleContent>
          {Object.entries(groupedRelations).map(([type, items]) => (
            <div key={type} className="mt-1.5">
              <span className="text-[11px] text-muted-foreground/70 px-2">
                {relationTypeLabels[type] || type}
              </span>
              <div className="flex flex-col mt-0.5">
                {items.map((item) => {
                  const assignee = getAssignee(item.task.userId);
                  const taskObj = buildTaskObject(item);

                  return (
                    <ContextMenu key={item.id}>
                      <ContextMenuTrigger asChild>
                        <div className="group flex items-center gap-2 py-1 px-2 rounded-md hover:bg-accent/50 transition-colors cursor-default">
                          <SubtaskStatusPopover
                            tasks={[taskObj]}
                            projectId={projectId}
                          >
                            <button
                              type="button"
                              className="shrink-0 flex items-center justify-center rounded p-0.5 transition-colors outline-none [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground"
                            >
                              {getColumnIcon(item.task.status, false)}
                            </button>
                          </SubtaskStatusPopover>

                          <button
                            type="button"
                            className="flex-1 min-w-0 text-left outline-none"
                            onClick={() => handleNavigateToTask(item.task.id)}
                          >
                            <span
                              className={`text-sm truncate block ${item.task.status === "done" ? "line-through text-muted-foreground" : "text-foreground/90"}`}
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
                                    {assignee?.user?.name
                                      ?.charAt(0)
                                      .toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <div
                                  className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-border/70"
                                  title="Unassigned"
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
                          onClick={() => handleNavigateToTask(item.task.id)}
                        >
                          <span>Open task</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          className="text-destructive"
                          onClick={() => handleRemoveRelation(item.id)}
                        >
                          <span>Remove relation</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            </div>
          ))}

          {totalCount === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1">
              No related tasks
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandDialogPopup>
          <Command items={commandGroups}>
            <CommandInput
              placeholder="Search tasks to link..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <CommandPanel>
              <CommandEmpty>
                <div className="text-center py-6">
                  <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No tasks found
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
                            {getColumnIcon(item.status, false)}
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
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${selectedRelationType === "related" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setSelectedRelationType("related")}
                >
                  <Link2 className="size-3" />
                  Related
                </button>
                <button
                  type="button"
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${selectedRelationType === "blocks" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setSelectedRelationType("blocks")}
                >
                  <X className="size-3" />
                  Blocks
                </button>
              </div>
              <span className="text-muted-foreground/60">
                Select a task to link
              </span>
            </CommandFooter>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>
    </>
  );
}
