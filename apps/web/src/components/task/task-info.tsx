import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import useDeleteTask from "@/hooks/mutations/task/use-delete-task";
import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import useGetActiveWorkspaceUsers from "@/hooks/queries/workspace-users/use-active-workspace-users";
import useProjectStore from "@/store/project";
import type Task from "@/types/task";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
                placeholder="Select status"
                onChange={(value) => {
                  field.onChange(value);
                  handleChange({ ...form.getValues(), status: value });
                }}
                options={
                  project?.columns?.map((col) => ({
                    value: col.id,
                    label: col.name,
                  })) || []
                }
              />
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
                placeholder="Assign to"
                onChange={(value) => {
                  field.onChange(value);
                  handleChange({ ...form.getValues(), userEmail: value });
                }}
                options={[
                  {
                    value: "",
                    label: "Unassigned",
                  },
                  ...(workspaceUsers?.map((user) => ({
                    value: user.userEmail ?? "",
                    label: user.userName ?? "",
                  })) || []),
                ]}
              />
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
                placeholder="Select priority"
                onChange={(value) => {
                  field.onChange(value);
                  handleChange({ ...form.getValues(), priority: value });
                }}
                options={[
                  {
                    value: "low",
                    label: "Low",
                    icon: <Flag className="w-4 h-4 text-blue-500" />,
                  },
                  {
                    value: "medium",
                    label: "Medium",
                    icon: <Flag className="w-4 h-4 text-yellow-500" />,
                  },
                  {
                    value: "high",
                    label: "High",
                    icon: <Flag className="w-4 h-4 text-red-500" />,
                  },
                  {
                    value: "urgent",
                    label: "Urgent",
                    icon: <Flag className="w-4 h-4 text-red-500" />,
                  },
                ]}
              />
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
        className="bg-red-600 text-white hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400"
      >
        {isDeleting ? "Deleting..." : "Delete Task"}
      </Button>
    </div>
  );
}

export default TaskInfo;
