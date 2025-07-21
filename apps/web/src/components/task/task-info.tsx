import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useDeleteTask from "@/hooks/mutations/task/use-delete-task";
import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import useGetActiveWorkspaceUsers from "@/hooks/queries/workspace-users/use-active-workspace-users";
import useProjectStore from "@/store/project";
import type Task from "@/types/task";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";
import TaskCalendar from "./task-calendar";
import TaskLabels from "./task-labels";

export const taskInfoSchema = z.object({
  status: z.string(),
  userEmail: z.string(),
  priority: z.string(),
  dueDate: z.date(),
});

function TaskInfo({
  task,
  setIsSaving,
}: {
  task: Task;
  setIsSaving: (isSaving: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { project } = useProjectStore();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers({
    workspaceId: project?.workspaceId ?? "",
  });
  const { mutateAsync: updateTask } = useUpdateTask();
  const { mutateAsync: deleteTask, isPending: isDeleting } = useDeleteTask();

  const form = useForm<z.infer<typeof taskInfoSchema>>({
    defaultValues: {
      status: task?.status || "",
      userEmail: task?.userEmail || "",
      priority: task?.priority || "",
      dueDate: task?.dueDate ? new Date(task.dueDate) : new Date(),
    },
  });

  const handleChange = async (data: z.infer<typeof taskInfoSchema>) => {
    if (!task) return;

    setIsSaving(true);
    try {
      await updateTask({
        ...task,
        userEmail: data.userEmail,
        status: data.status || "",
        priority: data.priority || "",
        dueDate: data.dueDate.toISOString(),
        projectId: project?.id || "",
      });
      toast.success("Task updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update task",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;

    try {
      await deleteTask(task.id);
      queryClient.invalidateQueries({
        queryKey: ["tasks", project?.id ?? ""],
      });
      toast.success("Task deleted successfully");
      navigate({
        to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
        params: {
          workspaceId: project?.workspaceId ?? "",
          projectId: project?.id ?? "",
        },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete task",
      );
    }
  };

  useEffect(() => {
    return () => {
      form.reset();
    };
  }, [form]);

  return (
    <div className="w-full md:w-96 flex-shrink-0 overflow-y-auto border-b border-zinc-200 dark:border-zinc-800 p-4 gap-4 border-l flex flex-col">
      <Form {...form}>
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  handleChange({ ...form.getValues(), status: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {project?.columns?.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      {column.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="userEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Assign to</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  handleChange({ ...form.getValues(), userEmail: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {workspaceUsers?.map((user) => {
                    return (
                      <SelectItem key={user.userEmail} value={user.userEmail}>
                        {user.userName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Priority</FormLabel>
              <Select
                value={field.value || ""}
                onValueChange={(value) => {
                  field.onChange(value);
                  handleChange({ ...form.getValues(), priority: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dueDate"
          render={({ field }) => (
            <TaskCalendar
              field={field}
              onChange={(value) => {
                field.onChange(value);
                handleChange({
                  ...form.getValues(),
                  dueDate: value ?? new Date(),
                });
              }}
            />
          )}
        />
        <TaskLabels taskId={task.id} setIsSaving={setIsSaving} />
      </Form>
      <Button
        onClick={handleDeleteTask}
        className="w-full mt-4 px-3 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isDeleting ? "Deleting..." : "Delete Task"}
      </Button>
    </div>
  );
}

export default TaskInfo;
