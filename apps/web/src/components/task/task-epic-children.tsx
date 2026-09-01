import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import CircularProgress from "@/components/ui/circular-progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import useCreateTask from "@/hooks/mutations/task/use-create-task";
import { useDeleteTask } from "@/hooks/mutations/task/use-delete-task";
import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import useCreateTaskRelation from "@/hooks/mutations/task-relation/use-create-task-relation";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import queryClient from "@/query-client";
import type Task from "@/types/task";
import SubtaskRow from "./subtask-row";

type TaskEpicChildrenProps = {
  taskId: string;
  projectId: string;
  workspaceId: string;
  parentStatus: string;
};

// Parallel to TaskSubtasks, but children are linked through "epic"-type
// relations rather than "subtask" ones. Keyboard navigation and multi-select
// are intentionally not replicated here to keep this smaller; add them if an
// epic's child list grows large enough to need them.
export default function TaskEpicChildren({
  taskId,
  projectId,
  workspaceId,
  parentStatus,
}: TaskEpicChildrenProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  const { data: relations = [] } = useGetTaskRelations(taskId);
  const { data: workspace } = useActiveWorkspace();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(
    workspace?.id ?? "",
  );
  const createTask = useCreateTask();
  const createRelation = useCreateTaskRelation();
  const { mutateAsync: deleteTask } = useDeleteTask();
  const { mutateAsync: updateTaskStatus } = useUpdateTaskStatus();
  const { data: columns = [], isLoading: isLoadingColumns } =
    useGetColumns(projectId);
  const { canCreateTasks, canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const canCreate = canCreateTasks();

  // Same column-slug mapping TaskSubtasks uses: the API validates status
  // against the project's real columns, so "done" here means "a final column".
  const doneSlug = columns.find((c) => c.isFinal)?.slug ?? "done";
  const todoSlug = columns.find((c) => !c.isFinal)?.slug;
  const canCreateChild =
    parentStatus === "planned" || (!isLoadingColumns && Boolean(todoSlug));
  const isCompleted = (status: string) =>
    columns.length > 0
      ? (columns.find((c) => c.slug === status)?.isFinal ?? false)
      : status === "done";

  const children = relations
    .filter((rel) => rel.relationType === "epic" && rel.sourceTaskId === taskId)
    .map((rel) => ({ relation: rel, task: rel.targetTask }))
    .filter(
      (item): item is typeof item & { task: NonNullable<typeof item.task> } =>
        item.task !== null,
    );

  const completedCount = children.filter((c) =>
    isCompleted(c.task.status),
  ).length;
  const totalCount = children.length;

  const buildTaskObject = (child: (typeof children)[number]): Task => ({
    id: child.task.id,
    title: child.task.title,
    number: child.task.number,
    description: null,
    status: child.task.status,
    priority: child.task.priority,
    startDate: null,
    dueDate: null,
    position: null,
    createdAt: "",
    userId: child.task.userId,
    assigneeId: child.task.userId,
    assigneeName: child.task.assigneeName,
    projectId: child.task.projectId,
  });

  const handleToggleComplete = async (taskObj: Task) => {
    try {
      await updateTaskStatus({
        ...taskObj,
        status: isCompleted(taskObj.status) ? (todoSlug ?? "to-do") : doneSlug,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.status.updateError"),
      );
    }
  };

  const getAssignee = (userId: string | null) => {
    if (!userId || !workspaceUsers?.members) return null;
    return (
      workspaceUsers.members.find((member) => member.userId === userId) ?? null
    );
  };

  const handleAddChild = async () => {
    if (!canCreate || !canEdit || !newTitle.trim()) return;
    const initialStatus = parentStatus === "planned" ? "planned" : todoSlug;
    if (!initialStatus) return;

    try {
      const newTask = await createTask.mutateAsync({
        title: newTitle.trim(),
        description: "",
        projectId,
        status: initialStatus,
        priority: "no-priority",
      });

      await createRelation.mutateAsync({
        sourceTaskId: taskId,
        targetTaskId: newTask.id,
        relationType: "epic",
      });

      setNewTitle("");
      setIsAdding(false);
    } catch {
      toast.error(t("tasks:epics.children.createError"));
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteTaskId) return;
    try {
      await deleteTask(deleteTaskId);
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["task-relations", taskId] });
      toast.success(t("tasks:epics.children.deleteSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:epics.children.deleteError"),
      );
    } finally {
      setDeleteTaskId(null);
    }
  };

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
                <span>{t("tasks:epics.children.title")}</span>
              </button>
            </CollapsibleTrigger>
            {totalCount > 0 && (
              <span className="flex items-center gap-1.5 ml-0.5">
                <CircularProgress
                  completed={completedCount}
                  total={totalCount}
                />
                <span className="text-xs text-muted-foreground">
                  {completedCount}/{totalCount}
                </span>
              </span>
            )}
          </div>
          {canEdit && canCreate && (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              aria-label={`${t("tasks:epics.children.addAction")} ${t("tasks:epics.children.title")}`}
              onClick={() => setIsAdding(true)}
              disabled={!canCreateChild}
            >
              <Plus className="size-3.5" />
            </Button>
          )}
        </div>

        <CollapsibleContent>
          <div className="flex flex-col mt-1">
            <AnimatePresence initial={false}>
              {children.map((child) => {
                const taskObj = buildTaskObject(child);

                return (
                  <SubtaskRow
                    key={child.task.id}
                    task={taskObj}
                    tasks={[taskObj]}
                    projectId={projectId}
                    workspaceId={workspace?.id ?? workspaceId}
                    isSelected={false}
                    isFocused={false}
                    isCompleted={isCompleted(child.task.status)}
                    canEdit={canEdit}
                    selectionRadius="rounded-md"
                    assignee={getAssignee(child.task.userId)}
                    onToggleComplete={() => handleToggleComplete(taskObj)}
                    onNavigate={() =>
                      navigate({
                        to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
                        params: {
                          workspaceId,
                          projectId,
                          taskId: child.task.id,
                        },
                      })
                    }
                    onDeleteClick={() => setDeleteTaskId(child.task.id)}
                  />
                );
              })}
            </AnimatePresence>
          </div>

          {isAdding && canEdit && canCreate && (
            <div className="flex items-center gap-2 mt-2">
              <Input
                size="sm"
                placeholder={t("tasks:epics.children.inputPlaceholder")}
                value={newTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewTitle(e.target.value)
                }
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") handleAddChild();
                  if (e.key === "Escape") {
                    setIsAdding(false);
                    setNewTitle("");
                  }
                }}
                autoFocus
              />
              <Button
                size="xs"
                onClick={handleAddChild}
                disabled={
                  !newTitle.trim() || createTask.isPending || !canCreateChild
                }
              >
                {t("tasks:epics.children.addAction")}
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setIsAdding(false);
                  setNewTitle("");
                }}
              >
                {t("common:actions.cancel")}
              </Button>
            </div>
          )}

          {!isAdding && totalCount === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1">
              {t("tasks:epics.children.empty")}
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog
        open={!!deleteTaskId}
        onOpenChange={(open) => !open && setDeleteTaskId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("tasks:epics.children.deleteDialogTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("tasks:epics.children.deleteDialogDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <AlertDialogClose
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteTask}
                />
              }
            >
              {t("tasks:epics.children.deleteAction")}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
