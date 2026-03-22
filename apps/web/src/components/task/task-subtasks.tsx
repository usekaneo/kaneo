import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, ListTree, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import useCreateTask from "@/hooks/mutations/task/use-create-task";
import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import useCreateTaskRelation from "@/hooks/mutations/task-relation/use-create-task-relation";
import useDeleteTaskRelation from "@/hooks/mutations/task-relation/use-delete-task-relation";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import { getColumnIcon } from "@/lib/column";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";

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
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const { data: relations = [] } = useGetTaskRelations(taskId);
  const createTask = useCreateTask();
  const createRelation = useCreateTaskRelation();
  const deleteRelation = useDeleteTaskRelation(taskId);
  const updateStatus = useUpdateTaskStatus();

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
  const progressPercent =
    totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleAddSubtask = async () => {
    if (!newTitle.trim()) return;

    try {
      const newTask = await createTask.mutateAsync({
        title: newTitle.trim(),
        description: "",
        projectId,
        status: "to-do",
        priority: "low",
      });

      await createRelation.mutateAsync({
        sourceTaskId: taskId,
        targetTaskId: newTask.id,
        relationType: "subtask",
      });

      setNewTitle("");
      setIsAdding(false);
    } catch {
      toast.error("Failed to create subtask");
    }
  };

  const handleToggleStatus = (subtask: {
    relation: { id: string };
    task: {
      id: string;
      status: string;
      projectId: string;
      title: string;
      number: number | null;
      priority: string | null;
      userId: string | null;
      assigneeName: string | null;
    };
  }) => {
    const newStatus = subtask.task.status === "done" ? "to-do" : "done";
    updateStatus.mutate({
      id: subtask.task.id,
      status: newStatus,
      projectId: subtask.task.projectId,
      title: subtask.task.title,
      number: subtask.task.number,
      description: null,
      priority: subtask.task.priority,
      dueDate: null,
      position: null,
      createdAt: "",
      userId: subtask.task.userId,
      assigneeId: subtask.task.userId,
      assigneeName: subtask.task.assigneeName,
    });
  };

  const handleRemoveSubtask = (relationId: string) => {
    deleteRelation.mutate(relationId);
  };

  const handleNavigateToTask = (subtaskId: string) => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: { workspaceId, projectId, taskId: subtaskId },
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-1 px-0 h-8 hover:bg-transparent"
          >
            {isOpen ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )}
            <ListTree className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Subtasks</span>
            {totalCount > 0 && (
              <span className="text-xs text-muted-foreground ml-1">
                {completedCount}/{totalCount}
              </span>
            )}
          </Button>
        </CollapsibleTrigger>
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
        {totalCount > 0 && (
          <div className="mt-2 mb-2">
            <div className="h-1.5 w-full rounded-full bg-input overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1 mt-1">
          {subtasks.map((subtask) => (
            <div
              key={subtask.relation.id}
              className="group flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors"
            >
              <Checkbox
                checked={subtask.task.status === "done"}
                onCheckedChange={() => handleToggleStatus(subtask)}
              />
              <button
                type="button"
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
                onClick={() => handleNavigateToTask(subtask.task.id)}
              >
                {getColumnIcon(subtask.task.status, false)}
                <span
                  className={`text-sm truncate flex-1 ${subtask.task.status === "done" ? "line-through text-muted-foreground" : "text-foreground/90"}`}
                >
                  {subtask.task.title}
                </span>
                {subtask.task.priority &&
                  subtask.task.priority !== "no-priority" && (
                    <span className="shrink-0">
                      {getPriorityIcon(subtask.task.priority)}
                    </span>
                  )}
              </button>
              <Button
                variant="ghost"
                size="xs"
                className="opacity-0 group-hover:opacity-100 text-muted-foreground h-5 w-5 p-0"
                onClick={() => handleRemoveSubtask(subtask.relation.id)}
              >
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </div>

        {isAdding && (
          <div className="flex items-center gap-2 mt-2">
            <Input
              size="sm"
              placeholder="Subtask title..."
              value={newTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewTitle(e.target.value)
              }
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  handleAddSubtask();
                }
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
              Add
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setIsAdding(false);
                setNewTitle("");
              }}
            >
              Cancel
            </Button>
          </div>
        )}

        {!isAdding && totalCount === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-1">
            No subtasks yet
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
