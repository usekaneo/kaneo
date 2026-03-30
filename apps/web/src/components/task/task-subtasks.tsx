import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import useCreateTaskRelation from "@/hooks/mutations/task-relation/use-create-task-relation";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { toast } from "@/lib/toast";
import queryClient from "@/query-client";
import type Task from "@/types/task";
import SubtaskRow from "./subtask-row";

type TaskSubtasksProps = {
  taskId: string;
  projectId: string;
  workspaceId: string;
};

export default function TaskSubtasks({
  taskId,
  projectId,
  workspaceId,
}: TaskSubtasksProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: relations = [] } = useGetTaskRelations(taskId);
  const { data: workspace } = useActiveWorkspace();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(
    workspace?.id ?? "",
  );
  const createTask = useCreateTask();
  const createRelation = useCreateTaskRelation();
  const { mutateAsync: deleteTask } = useDeleteTask();

  const subtasks = relations
    .filter(
      (rel) => rel.relationType === "subtask" && rel.sourceTaskId === taskId,
    )
    .map((rel) => ({ relation: rel, task: rel.targetTask }))
    .filter(
      (item): item is typeof item & { task: NonNullable<typeof item.task> } =>
        item.task !== null,
    );

  const completedCount = subtasks.filter(
    (s) => s.task.status === "done",
  ).length;
  const totalCount = subtasks.length;
  const hasSelection = selectedIds.size > 0;

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setFocusedIndex(-1);
  }, []);

  const buildTaskObject = (subtask: (typeof subtasks)[number]): Task => ({
    id: subtask.task.id,
    title: subtask.task.title,
    number: subtask.task.number,
    description: null,
    status: subtask.task.status,
    priority: subtask.task.priority,
    startDate: null,
    dueDate: null,
    position: null,
    createdAt: "",
    userId: subtask.task.userId,
    assigneeId: subtask.task.userId,
    assigneeName: subtask.task.assigneeName,
    projectId: subtask.task.projectId,
  });

  const getTargetTasks = (currentTask: Task): Task[] => {
    if (hasSelection && selectedIds.has(currentTask.id)) {
      return subtasks
        .filter((s) => selectedIds.has(s.task.id))
        .map(buildTaskObject);
    }
    return [currentTask];
  };

  const getAssignee = (userId: string | null) => {
    if (!userId || !workspaceUsers?.members) return null;
    return (
      workspaceUsers.members.find((member) => member.userId === userId) ?? null
    );
  };

  const getSelectionRadius = (index: number, isSelected: boolean) => {
    if (!isSelected) return "rounded-md";

    const prevSelected =
      index > 0 && selectedIds.has(subtasks[index - 1].task.id);
    const nextSelected =
      index < subtasks.length - 1 &&
      selectedIds.has(subtasks[index + 1].task.id);

    if (prevSelected && nextSelected) return "rounded-none";
    if (prevSelected) return "rounded-t-none rounded-b-md";
    if (nextSelected) return "rounded-t-md rounded-b-none";
    return "rounded-md";
  };

  // Keyboard navigation
  useEffect(() => {
    const container = containerRef.current;
    if (!container || totalCount === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, [contenteditable='true'], .ProseMirror",
        )
      )
        return;

      if (!container.contains(document.activeElement) && focusedIndex === -1)
        return;

      switch (e.key) {
        case "ArrowDown":
        case "j": {
          e.preventDefault();
          setFocusedIndex((prev) => (prev < totalCount - 1 ? prev + 1 : prev));
          break;
        }
        case "ArrowUp":
        case "k": {
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        }
        case " ": {
          if (focusedIndex >= 0 && focusedIndex < totalCount) {
            e.preventDefault();
            toggleSelection(subtasks[focusedIndex].task.id);
          }
          break;
        }
        case "Enter": {
          if (focusedIndex >= 0 && focusedIndex < totalCount) {
            e.preventDefault();
            navigate({
              to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
              params: {
                workspaceId,
                projectId,
                taskId: subtasks[focusedIndex].task.id,
              },
            });
          }
          break;
        }
        case "Escape": {
          if (hasSelection) {
            e.preventDefault();
            clearSelection();
          } else if (focusedIndex >= 0) {
            e.preventDefault();
            setFocusedIndex(-1);
          }
          break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    focusedIndex,
    totalCount,
    subtasks,
    hasSelection,
    clearSelection,
    navigate,
    workspaceId,
    projectId,
    toggleSelection,
  ]);

  const handleAddSubtask = async () => {
    if (!newTitle.trim()) return;

    try {
      const newTask = await createTask.mutateAsync({
        title: newTitle.trim(),
        description: "",
        projectId,
        status: "to-do",
        priority: "no-priority",
      });

      await createRelation.mutateAsync({
        sourceTaskId: taskId,
        targetTaskId: newTask.id,
        relationType: "subtask",
      });

      setNewTitle("");
      setIsAdding(false);
    } catch {
      toast.error(t("tasks:subtasks.createError"));
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteTaskId) return;
    try {
      await deleteTask(deleteTaskId);
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["task-relations", taskId] });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTaskId);
        return next;
      });
      toast.success(t("tasks:subtasks.deleteSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:subtasks.deleteError"),
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
                <span>{t("tasks:subtasks.title")}</span>
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
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>

        <CollapsibleContent>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard nav managed via document listener */}
          <div
            ref={containerRef}
            className="flex flex-col mt-1"
            onMouseDown={() => {
              if (focusedIndex === -1 && !hasSelection) {
                setFocusedIndex(0);
              }
            }}
          >
            <AnimatePresence initial={false}>
              {subtasks.map((subtask, index) => {
                const taskObj = buildTaskObject(subtask);
                const isSelected = selectedIds.has(subtask.task.id);

                return (
                  <SubtaskRow
                    key={subtask.task.id}
                    task={taskObj}
                    tasks={getTargetTasks(taskObj)}
                    projectId={projectId}
                    workspaceId={workspace?.id ?? workspaceId}
                    isSelected={isSelected}
                    isFocused={focusedIndex === index}
                    selectionRadius={getSelectionRadius(index, isSelected)}
                    assignee={getAssignee(subtask.task.userId)}
                    onToggleSelection={() => toggleSelection(subtask.task.id)}
                    onNavigate={() =>
                      navigate({
                        to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
                        params: {
                          workspaceId,
                          projectId,
                          taskId: subtask.task.id,
                        },
                      })
                    }
                    onDeleteClick={() => setDeleteTaskId(subtask.task.id)}
                  />
                );
              })}
            </AnimatePresence>
          </div>

          {isAdding && (
            <div className="flex items-center gap-2 mt-2">
              <Input
                size="sm"
                placeholder={t("tasks:subtasks.inputPlaceholder")}
                value={newTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewTitle(e.target.value)
                }
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") handleAddSubtask();
                  if (e.key === "Escape") {
                    setIsAdding(false);
                    setNewTitle("");
                  }
                }}
                autoFocus
              />
              <Button
                size="xs"
                onClick={handleAddSubtask}
                disabled={!newTitle.trim() || createTask.isPending}
              >
                {t("tasks:subtasks.addAction")}
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
              {t("tasks:subtasks.empty")}
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
              {t("tasks:subtasks.deleteDialogTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("tasks:subtasks.deleteDialogDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose>
              <Button variant="outline" size="sm">
                {t("common:actions.cancel")}
              </Button>
            </AlertDialogClose>
            <AlertDialogClose onClick={handleDeleteTask}>
              <Button variant="destructive" size="sm">
                {t("tasks:subtasks.deleteAction")}
              </Button>
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
