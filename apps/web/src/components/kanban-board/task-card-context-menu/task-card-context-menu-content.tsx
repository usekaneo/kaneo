import {
  Calendar as CalendarIcon,
  Copy,
  Flag,
  FlipHorizontal2,
  ListTodo,
  Tags,
  Trash,
  User,
} from "lucide-react";

import useCreateTask from "@/hooks/mutations/task/use-create-task";
import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useGetActiveWorkspaceUsers from "@/hooks/queries/workspace-users/use-active-workspace-users";

import type { taskInfoSchema } from "@/components/task/task-info";
import { Calendar } from "@/components/ui/calendar";
import {
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";

import useDeleteTask from "@/hooks/mutations/task/use-delete-task";
import { generateLink } from "@/lib/generate-link";
import queryClient from "@/query-client";
import type Task from "@/types/task";
import { useMemo } from "react";
import { toast } from "sonner";
import type { z } from "zod/v4";

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
  const { data: projects } = useGetProjects({
    workspaceId: taskCardContext.worskpaceId,
  });
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers({
    workspaceId: taskCardContext.worskpaceId,
  });
  const { mutateAsync: updateTask } = useUpdateTask();
  const { mutateAsync: createTask } = useCreateTask();
  const { mutateAsync: deleteTask } = useDeleteTask();

  const projectsOptions = useMemo(() => {
    return projects?.map((project) => {
      return { label: project.name, value: project.id };
    });
  }, [projects]);

  const usersOptions = useMemo(() => {
    return workspaceUsers?.map((user) => ({
      label: user.userName ?? user.userEmail,
      value: user.userEmail,
    }));
  }, [workspaceUsers]);

  const statusOptions = [
    {
      label: "To Do",
      value: "to-do",
    },
    {
      label: "In Progress",
      value: "in-progress",
    },
    {
      label: "In Review",
      value: "in-review",
    },
    {
      label: "Done",
      value: "done",
    },
  ];

  const handleCopyTaskLink = () => {
    const path = `/dashboard/workspace/${taskCardContext.worskpaceId}/project/${taskCardContext.projectId}/task/${task.id}`;
    const taskLink = generateLink(path);

    navigator.clipboard.writeText(taskLink);
    toast.success("Task link copied!");
  };

  const handleDuplicateTask = async (projectId: string) => {
    const selectedProject = projectsOptions?.find(
      (project) => project.value === projectId,
    );

    const newTask = {
      description: task.description ?? "",
      dueDate: task.dueDate ?? "",
      position: 0,
      priority: task.priority as "low" | "medium" | "high" | "urgent",
      status: task.status,
      title: task.title,
      userEmail: task.userEmail ?? "",
      projectId,
    };

    try {
      await createTask(newTask);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update task",
      );
    } finally {
      toast.success(`Mirrored task successfully to: ${selectedProject?.label}`);
    }
  };

  const handleChange = async (
    field: keyof z.infer<typeof taskInfoSchema>,
    value: string | Date,
  ) => {
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
    <ContextMenuContent>
      <ContextMenuItem
        onClick={handleCopyTaskLink}
        className="flex items-center gap-2 cursor-pointer"
      >
        <Copy className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 " />
        Copy Link
      </ContextMenuItem>

      <ContextMenuSub>
        <ContextMenuSubTrigger className="flex items-center gap-2">
          <Tags className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />{" "}
          Priority
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuCheckboxItem
            onClick={() => handleChange("priority", "low")}
            className="flex items-center gap-2 cursor-pointer"
            checked={task.priority === "low"}
          >
            <Flag className="w-3.5 h-3.5 text-blue-400" />
            Low
          </ContextMenuCheckboxItem>
          <ContextMenuCheckboxItem
            onClick={() => handleChange("priority", "medium")}
            className="flex items-center gap-2 cursor-pointer"
            checked={task.priority === "medium"}
          >
            <Flag className="w-3.5 h-3.5 text-yellow-400" />
            Medium
          </ContextMenuCheckboxItem>
          <ContextMenuCheckboxItem
            onClick={() => handleChange("priority", "high")}
            className="flex items-center gap-2 cursor-pointer"
            checked={task.priority === "high"}
          >
            <Flag className="w-3.5 h-3.5 text-red-400" />
            High
          </ContextMenuCheckboxItem>
          <ContextMenuCheckboxItem
            onClick={() => handleChange("priority", "urgent")}
            className="flex items-center gap-2 cursor-pointer"
            checked={task.priority === "urgent"}
          >
            <Flag className="w-3.5 h-3.5 text-red-400" />
            Urgent
          </ContextMenuCheckboxItem>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSub>
        <ContextMenuSubTrigger className="flex items-center gap-2">
          <ListTodo className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />{" "}
          Status
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {statusOptions.map((status) => (
            <ContextMenuCheckboxItem
              key={status.value}
              checked={task.status === status.value}
              onCheckedChange={() => handleChange("status", status.value)}
              className="flex items-center justify-between cursor-pointer"
            >
              {status.label}
            </ContextMenuCheckboxItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSub>
        <ContextMenuSubTrigger className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />{" "}
          Assignee
        </ContextMenuSubTrigger>

        {usersOptions && (
          <ContextMenuSubContent>
            {usersOptions.map((user) => (
              <ContextMenuCheckboxItem
                key={user.value}
                checked={task.userEmail === user.value}
                onCheckedChange={() =>
                  handleChange("userEmail", user.value ?? "")
                }
                className="flex items-center justify-between cursor-pointer"
              >
                {user.label}
              </ContextMenuCheckboxItem>
            ))}
            <ContextMenuCheckboxItem
              checked={!task.userEmail}
              onCheckedChange={() => handleChange("userEmail", "")}
              className="flex items-center justify-between cursor-pointer"
            >
              Unassigned
            </ContextMenuCheckboxItem>
          </ContextMenuSubContent>
        )}
      </ContextMenuSub>

      <ContextMenuSub>
        <ContextMenuSubTrigger className="flex items-center gap-2">
          <FlipHorizontal2 className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />{" "}
          Mirror
        </ContextMenuSubTrigger>

        {projectsOptions && (
          <ContextMenuSubContent>
            {projectsOptions.map((project) => (
              <ContextMenuItem
                key={project.value}
                onClick={() => handleDuplicateTask(project.value)}
                className="flex items-center justify-between cursor-pointer"
              >
                {project.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        )}
      </ContextMenuSub>

      <ContextMenuSub>
        <ContextMenuSubTrigger className="flex items-center gap-2">
          <CalendarIcon className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />{" "}
          Due date
        </ContextMenuSubTrigger>
        {projectsOptions && (
          <ContextMenuSubContent>
            <Calendar
              mode="single"
              selected={task.dueDate ? new Date(task.dueDate) : undefined}
              onSelect={(value) => handleChange("dueDate", String(value))}
              className="w-auto border-none"
              initialFocus
            />
          </ContextMenuSubContent>
        )}
      </ContextMenuSub>

      <ContextMenuItem
        onClick={handleDeleteTask}
        className="flex items-center transition-all duration-200 gap-2  cursor-pointer"
      >
        <Trash className="w-3.5 h-3.5 text-red-400" />
        Delete Task
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
