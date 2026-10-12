import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Form, FormField } from "@/components/ui/form";
import { useUpdateTaskTitle } from "@/hooks/mutations/task/use-update-task-title";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { useAutoGrowTextarea } from "@/hooks/use-auto-grow-textarea";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import debounce from "@/lib/debounce";
import { stripLineBreaks } from "@/lib/strip-line-breaks";

type TaskTitleProps = {
  taskId: string;
};

export default function TaskTitle({ taskId }: TaskTitleProps) {
  const { t } = useTranslation();
  const { data: task } = useGetTask(taskId);
  const { mutateAsync: updateTaskTitle } = useUpdateTaskTitle();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const isInitializedRef = useRef(false);
  const taskRef = useRef(task);
  const updateTaskRef = useRef(updateTaskTitle);

  useEffect(() => {
    taskRef.current = task;
    updateTaskRef.current = updateTaskTitle;
  }, [task, updateTaskTitle]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- taskId is not needed here
  useEffect(() => {
    isInitializedRef.current = false;
  }, [taskId]);

  const form = useForm<{
    title: string;
  }>({
    values: {
      title: task?.title || "",
    },
  });

  useEffect(() => {
    if (task?.title !== undefined) isInitializedRef.current = true;
  }, [task?.title]);

  const debouncedUpdate = useMemo(
    () =>
      debounce(async (title: string) => {
        if (!isInitializedRef.current) return;

        const currentTask = taskRef.current;
        const updateTaskFn = updateTaskRef.current;

        if (!currentTask || !updateTaskFn) return;

        try {
          await updateTaskFn({
            ...currentTask,
            title,
          });
        } catch (error) {
          console.error("Failed to update title:", error);
        }
      }, 800),
    [],
  );

  const title = form.watch("title");
  const textareaRef = useAutoGrowTextarea(title);

  const handleTitleChange = useCallback(
    (value: string) => {
      if (!isInitializedRef.current) return;

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
          <textarea
            {...field}
            ref={(element) => {
              field.ref(element);
              textareaRef.current = element;
            }}
            rows={1}
            placeholder={t("tasks:detail.titlePlaceholder")}
            readOnly={!canEdit}
            className="block h-auto w-full resize-none appearance-none overflow-hidden border-0 bg-transparent p-0 font-heading text-2xl leading-[1.15] font-semibold tracking-[-0.02em] text-foreground outline-none placeholder:text-foreground/45 sm:text-[2rem]"
            onKeyDown={(e) => {
              // Titles are single-line; Enter commits instead of adding a break.
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            onChange={(e) => {
              const value = stripLineBreaks(e.target.value);
              field.onChange(value);
              handleTitleChange(value);
            }}
          />
        )}
      />
    </Form>
  );
}
