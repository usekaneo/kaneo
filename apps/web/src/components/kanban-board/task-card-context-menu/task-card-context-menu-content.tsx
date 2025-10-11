import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { useDeleteTask } from "@/hooks/mutations/task/use-delete-task";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { getColumnIcon } from "@/lib/column";
import { generateLink } from "@/lib/generate-link";
import { getPriorityIcon } from "@/lib/priority";
import queryClient from "@/query-client";
import type Task from "@/types/task";

interface TaskCardContext {
  worskpaceId: string;
  projectId: string;
}

interface TaskCardContextMenuContentProps {
  task: Task;
  taskCardContext: TaskCardContext;
}

export default function TaskCardContextMenuContent({
  task,
  taskCardContext,
}: TaskCardContextMenuContentProps) {
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(
    taskCardContext.worskpaceId,
  );
  const { mutateAsync: updateTask } = useUpdateTask();
  const { mutateAsync: deleteTask } = useDeleteTask();
  const [isDeleteTaskModalOpen, setIsDeleteTaskModalOpen] = useState(false);

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
      await updateTask({
        ...task,
        [field]: value,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update task",
      );
    } finally {
      toast.success("Task updated successfully");
    }
  };

  const handleDeleteTask = async () => {
    try {
      await deleteTask(task.id);
      queryClient.invalidateQueries({
        queryKey: ["tasks", taskCardContext.projectId],
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete task",
      );
    } finally {
      toast.success("Task deleted successfully");
    }
  };

  return (
    <>
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
                  onCheckedChange={() =>
                    handleChange("userId", user.value ?? "")
                  }
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
          onClick={() => setIsDeleteTaskModalOpen(true)}
        >
          <span>Delete...</span>
        </ContextMenuItem>
      </ContextMenuContent>

      <AlertDialog
        open={isDeleteTaskModalOpen}
        onOpenChange={setIsDeleteTaskModalOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the task and all its data. You can't
              undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
