import {
  Calendar as CalendarIcon,
  Copy,
  Flag,
  FlipHorizontal2,
  ListTodo,
  Tags,
  User,
} from "lucide-react";

import useCreateTask from "@/hooks/mutations/task/use-create-task";
import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useGetWorkspaceUsers from "@/hooks/queries/workspace-users/use-get-workspace-users";

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
import { generateLink } from "@/lib/generate-link";
import type { Task } from "@/types/project";
import { toast } from "sonner";
import type { z } from "zod";

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
  const { data: workspaceUsers } = useGetWorkspaceUsers({
    workspaceId: taskCardContext.worskpaceId,
  });
  const { mutateAsync: updateTask } = useUpdateTask();
  const { mutateAsync: createTask } = useCreateTask();

  const projectOptions = projects?.map((project) => {
    return { label: project.name, value: project.id };
  });

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

  const usersOptions = workspaceUsers?.map((user) => ({
    label: user.userName ? user.userName : user.userEmail,
    value: user.userEmail,
  }));

  function handleCopyTaskLink() {
    const path = `/dashboard/workspace/${taskCardContext.worskpaceId}/project/${taskCardContext.projectId}/task/${task.id}`;
    const taskLink = generateLink(path);

    navigator.clipboard.writeText(taskLink);
    toast.success("Task link copied!");
  }

  async function handleDuplicateTask(projectId: string) {
    const selectedProject = projectOptions?.find(
      (project) => project.value === projectId,
    );

    const newTask = {
      description: task.description ?? "",
      dueDate: task.dueDate ?? new Date(),
      position: 0,
      priority: task.priority as "low" | "medium" | "high" | "urgent",
      status: task.status,
      title: task.title,
      userEmail: task.userEmail ?? "",
      projectId,
    };

    try {
      await createTask(newTask);
      toast.success(`Mirrored task successfully to: ${selectedProject?.label}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update task",
      );
    }
  }

  const handleChange = async (
    field: keyof z.infer<typeof taskInfoSchema>,
    value: string | Date,
  ) => {

    try {
      await updateTask({
        ...task,
        [field]: value,
      });
      toast.success("Task updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update task",
      );
    }
  };

  return (
    <ContextMenuContent>
      <ContextMenuItem
        onClick={handleCopyTaskLink}
        className="flex items-center gap-2 cursor-pointer hover:bg-accent "
      >
        <Copy className="w-4 h-4 text-indigo-400 " />
        Copy Link
      </ContextMenuItem>

      <ContextMenuSub>
        <ContextMenuSubTrigger className="flex items-center gap-2">
          <Tags className="h-4 w-4 text-indigo-400" /> Priority
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuCheckboxItem
            onClick={() => handleChange("priority", "low")}
            className="flex items-center gap-2 cursor-pointer hover:bg-accent"
            checked={task.priority === "low"}
          >
            <Flag className="w-4 h-4 text-blue-400" />
            Low
          </ContextMenuCheckboxItem>
          <ContextMenuCheckboxItem
            onClick={() => handleChange("priority", "medium")}
            className="flex items-center gap-2 cursor-pointer hover:bg-accent"
            checked={task.priority === "medium"}
          >
            <Flag className="w-4 h-4 text-yellow-400" />
            Medium
          </ContextMenuCheckboxItem>
          <ContextMenuCheckboxItem
            onClick={() => handleChange("priority", "high")}
            className="flex items-center gap-2 cursor-pointer hover:bg-accent"
            checked={task.priority === "high"}
          >
            <Flag className="w-4 h-4 text-red-400" />
            High
          </ContextMenuCheckboxItem>
          <ContextMenuCheckboxItem
            onClick={() => handleChange("priority", "urgent")}
            className="flex items-center gap-2 cursor-pointer hover:bg-accent"
            checked={task.priority === "urgent"}
          >
            <Flag className="w-4 h-4 text-red-400" />
            Urgent
          </ContextMenuCheckboxItem>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSub>
        <ContextMenuSubTrigger className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-indigo-400" /> Status
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
          <User className="h-4 w-4 text-indigo-400" /> Assign to
        </ContextMenuSubTrigger>

        {usersOptions && (
          <ContextMenuSubContent>
            {usersOptions.map((user) => (
              <ContextMenuCheckboxItem
                key={user.value}
                checked={task.userEmail === user.value}
                onCheckedChange={() => handleChange("userEmail", user.value)}
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
          <FlipHorizontal2 className="h-4 w-4 text-indigo-400" /> Mirror to
        </ContextMenuSubTrigger>

        {projectOptions && (
          <ContextMenuSubContent>
            {projectOptions.map((project) => (
              <ContextMenuItem
                key={project.value}
                onClick={() =>
                  handleDuplicateTask(project.value)
                }
                className="flex items-center justify-between cursor-pointer hover:bg-accent"
              >
                {project.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        )}
      </ContextMenuSub>

      <ContextMenuSub>
        <ContextMenuSubTrigger className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-indigo-400" /> Due date
        </ContextMenuSubTrigger>
        {projectOptions && (
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
    </ContextMenuContent>
  );
}
