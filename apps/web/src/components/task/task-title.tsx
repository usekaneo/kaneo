import { useCallback, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";

import { Form, FormControl, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useUpdateTaskTitle } from "@/hooks/mutations/task/use-update-task-title";
import useGetTask from "@/hooks/queries/task/use-get-task";
import debounce from "@/lib/debounce";

type TaskTitleProps = {
  taskId: string;
};

export default function TaskTitle({ taskId }: TaskTitleProps) {
  const { data: task } = useGetTask(taskId);
  const { mutateAsync: updateTaskTitle } = useUpdateTaskTitle();
  const isInitializedRef = useRef(false);
  const taskRef = useRef(task);
  const updateTaskRef = useRef(updateTaskTitle);

  useEffect(() => {
    taskRef.current = task;
    updateTaskRef.current = updateTaskTitle;
  }, [task, updateTaskTitle]);

  const form = useForm<{
    title: string;
  }>({
    values: {
      title: task?.title || "",
    },
  });

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

      const currentTask = taskRef.current;
      const updateTaskFn = updateTaskRef.current;

      if (!currentTask || !updateTaskFn) return;

      try {
        await updateTaskFn({
          ...currentTask,
          title: title,
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
