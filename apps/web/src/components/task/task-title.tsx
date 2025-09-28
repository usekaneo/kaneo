import { useCallback, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";

import { Form, FormControl, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import useGetTask from "@/hooks/queries/task/use-get-task";
import debounce from "@/lib/debounce";

interface TaskTitleProps {
  taskId: string;
}

export default function TaskTitle({ taskId }: TaskTitleProps) {
  const { data: task } = useGetTask(taskId);
  const { mutateAsync: updateTask } = useUpdateTask();
  const isInitializedRef = useRef(false);
  const taskRef = useRef(task);
  const updateTaskRef = useRef(updateTask);

  // Keep refs updated with latest values
  useEffect(() => {
    taskRef.current = task;
    updateTaskRef.current = updateTask;
  }, [task, updateTask]);

  const form = useForm<{
    title: string;
  }>({
    values: {
      title: task?.title || "",
    },
  });

  // Mark as initialized once we have the task data
  useEffect(() => {
    if (task?.title !== undefined && !isInitializedRef.current) {
      setTimeout(() => {
        isInitializedRef.current = true;
      }, 100);
    }
  }, [task?.title]);

  const debouncedUpdate = useCallback(
    debounce(async (title: string) => {
      if (!isInitializedRef.current) return;

      // Get the current task data from ref
      const currentTask = taskRef.current;
      const updateTaskFn = updateTaskRef.current;

      if (!currentTask || !updateTaskFn) return;

      try {
        await updateTaskFn({
          ...currentTask,
          title: title,
          userId: currentTask.userId || "",
          description: currentTask.description || "",
          status: currentTask.status || "",
          dueDate: currentTask.dueDate
            ? new Date(currentTask.dueDate).toISOString()
            : "",
          priority: currentTask.priority || "",
          position: currentTask.position || 0,
        });
        console.log("Title updated successfully");
      } catch (error) {
        console.error("Failed to update title:", error);
      }
    }, 800),
    [],
  );

  const handleTitleChange = useCallback(
    (value: string) => {
      if (!isInitializedRef.current) {
        console.log("Title change ignored - not initialized yet");
        return;
      }

      console.log("Title changed:", value);
      debouncedUpdate(value);
    },
    [debouncedUpdate],
  );

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormControl>
            <Input
              {...field}
              placeholder="Click to add a title"
              className="!text-2xl font-semibold !border-0 px-0 py-3 !shadow-none focus-visible:!ring-0 !bg-transparent text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-400 tracking-tight focus:!outline-none focus-visible:!outline-none"
              onChange={(e) => {
                field.onChange(e);
                handleTitleChange(e.target.value);
              }}
            />
          </FormControl>
        )}
      />
    </Form>
  );
}
