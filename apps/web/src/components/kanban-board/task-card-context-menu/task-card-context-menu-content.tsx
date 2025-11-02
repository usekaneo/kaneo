import { useMemo } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import {
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useUpdateTaskAssignee } from "@/hooks/mutations/task/use-update-task-assignee";
import { useUpdateTaskDescription } from "@/hooks/mutations/task/use-update-task-description";
import { useUpdateTaskDueDate } from "@/hooks/mutations/task/use-update-task-due-date";
import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import { useUpdateTaskPriority } from "@/hooks/mutations/task/use-update-task-status-priority";
import { useUpdateTaskTitle } from "@/hooks/mutations/task/use-update-task-title";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { getColumnIcon } from "@/lib/column";
import { generateLink } from "@/lib/generate-link";
import { getPriorityIcon } from "@/lib/priority";
import type Task from "@/types/task";

interface TaskCardContext {
  worskpaceId: string;
  projectId: string;
}

interface TaskCardContextMenuContentProps {
  task: Task;
  taskCardContext: TaskCardContext;
  onDeleteClick: () => void;
}

export default function TaskCardContextMenuContent({
  task,
  taskCardContext,
  onDeleteClick,
}: TaskCardContextMenuContentProps) {
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(
    taskCardContext.worskpaceId,
  );
  const { mutateAsync: updateTask } = useUpdateTask();
  const { mutateAsync: updateTaskPriority } = useUpdateTaskPriority();
  const { mutateAsync: updateTaskStatus } = useUpdateTaskStatus();
  const { mutateAsync: updateTaskAssignee } = useUpdateTaskAssignee();
  const { mutateAsync: updateTaskTitle } = useUpdateTaskTitle();
  const { mutateAsync: updateTaskDescription } = useUpdateTaskDescription();
  const { mutateAsync: updateTaskDueDate } = useUpdateTaskDueDate();

  const usersOptions = useMemo(() => {
    return workspaceUsers?.members?.map((member) => ({
      label: member?.user?.name ?? member.userId,
      value: member.userId,
      image: member?.user?.image ?? "",
      name: member?.user?.name ?? "",
    }));
  }, [workspaceUsers]);

  const handleCopyTaskLink = () => {
    const path = `/dashboard/workspace/${taskCardContext.worskpaceId}/project/${taskCardContext.projectId}/task/${task.id}`;
    const taskLink = generateLink(path);

    navigator.clipboard.writeText(taskLink);
    toast.success("Task link copied!");
  };

  const handleChange = async (field: keyof Task, value: string | Date) => {
    try {
      switch (field) {
        case "priority":
          await updateTaskPriority({ ...task, priority: value as string });
          break;
        case "status":
          await updateTaskStatus({ ...task, status: value as string });
          break;
        case "userId":
          await updateTaskAssignee({ ...task, userId: value as string });
          break;
        case "title":
          await updateTaskTitle({ ...task, title: value as string });
          break;
        case "description":
          await updateTaskDescription({
            ...task,
            description: value as string,
          });
          break;
        default:
          await updateTask({
            ...task,
            [field]: value,
          });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update task",
      );
    } finally {
      toast.success("Task updated successfully");
    }
  };

  return (
    <ContextMenuContent className="w-46">
      <ContextMenuItem onClick={handleCopyTaskLink}>
        <span>Copy link</span>
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuSub>
        <ContextMenuSubTrigger className="gap-2">
          <span>Priority</span>
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-48">
          <ContextMenuCheckboxItem
            key="no-priority"
            checked={task.priority === "no-priority"}
            onCheckedChange={() => handleChange("priority", "no-priority")}
            className="[&_svg]:text-muted-foreground"
          >
            {getPriorityIcon("no-priority")}
            <span>No Priority</span>
          </ContextMenuCheckboxItem>
          {["low", "medium", "high", "urgent"].map((priority) => (
            <ContextMenuCheckboxItem
              key={priority}
              checked={task.priority === priority}
              onCheckedChange={() => handleChange("priority", priority)}
              className="[&_svg]:text-muted-foreground"
            >
              {getPriorityIcon(priority)}
              <span className="capitalize">{priority}</span>
            </ContextMenuCheckboxItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <span>Status</span>
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-48">
          {["to-do", "in-progress", "in-review", "done"].map((status) => (
            <ContextMenuCheckboxItem
              key={status}
              checked={task.status === status}
              onCheckedChange={() => handleChange("status", status)}
              className="[&_svg]:text-muted-foreground"
            >
              {getColumnIcon(status)}
              <span className="capitalize">{status}</span>
            </ContextMenuCheckboxItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <span>Due date</span>
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-64 p-2">
          <Calendar
            mode="single"
            selected={task.dueDate ? new Date(task.dueDate) : undefined}
            onSelect={async (date) => {
              try {
                await updateTaskDueDate({
                  ...task,
                  dueDate: date?.toISOString() || null,
                });
                toast.success("Task due date updated successfully");
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Failed to update task due date",
                );
              }
            }}
            className="w-full !bg-popover"
          />
        </ContextMenuSubContent>
      </ContextMenuSub>

      {usersOptions && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <span>Assignee</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuCheckboxItem
              checked={!task.userId}
              onCheckedChange={() => handleChange("userId", "")}
            >
              <div
                className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center"
                title="Unassigned"
              >
                <span className="text-[10px] font-medium text-muted-foreground">
                  ?
                </span>{" "}
              </div>
              Unassigned
            </ContextMenuCheckboxItem>
            {usersOptions.map((user) => (
              <ContextMenuCheckboxItem
                key={user.value}
                checked={task.userId === user.value}
                onCheckedChange={() => handleChange("userId", user.value ?? "")}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user.image ?? ""} alt={user.name || ""} />
                  <AvatarFallback className="text-xs font-medium border border-border/30">
                    {user.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {user.label}
              </ContextMenuCheckboxItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}

      <ContextMenuSeparator />

      <ContextMenuItem onClick={() => handleChange("status", "archived")}>
        <span>Archive</span>
      </ContextMenuItem>

      <ContextMenuItem onClick={() => handleChange("status", "planned")}>
        <span>Mark as planned</span>
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem
        className="text-destructive"
        onClick={(e) => {
          e.preventDefault();
          // Delay to ensure context menu closes before dialog opens
          setTimeout(() => {
            onDeleteClick();
          }, 0);
        }}
      >
        <span>Delete...</span>
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
