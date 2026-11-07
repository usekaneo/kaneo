import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Form, FormField } from "@/components/ui/form";
import { useUpdateTaskTitle } from "@/hooks/mutations/task/use-update-task-title";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { useAutoGrowTextarea } from "@/hooks/use-auto-grow-textarea";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import debounce from "@/lib/debounce";
import { stripLineBreaks } from "@/lib/strip-line-breaks";
import type Task from "@/types/task";

type TaskTitleProps = {
  taskId: string;
  size?: "md" | "lg";
};

type PendingSave = { task: Task; title: string };

export default function TaskTitle({ taskId, size = "md" }: TaskTitleProps) {
  const { t } = useTranslation();
  const { data: task } = useGetTask(taskId);
  const { mutateAsync: updateTaskTitle } = useUpdateTaskTitle();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const taskRef = useRef(task);
  const shownTaskIdRef = useRef(taskId);
  const updateTaskRef = useRef(updateTaskTitle);
  // The server value must not replace text the user is still working on:
  // while the field is focused, or while it holds text not yet saved.
  const isFocusedRef = useRef(false);
  const hasUnsavedRef = useRef(false);
  const isSavingRef = useRef(false);
  const queuedSaveRef = useRef<PendingSave | null>(null);

  const form = useForm<{
    title: string;
  }>({
    defaultValues: {
      title: task?.title ?? "",
    },
  });

  const syncFromServer = useCallback(() => {
    const serverTitle = taskRef.current?.title;
    if (serverTitle === undefined) return;
    if (isFocusedRef.current || hasUnsavedRef.current) return;
    if (form.getValues("title") !== serverTitle)
      form.reset({ title: serverTitle });
  }, [form]);

  useEffect(() => {
    updateTaskRef.current = updateTaskTitle;
  }, [updateTaskTitle]);

  useEffect(() => {
    taskRef.current = task;
    if (shownTaskIdRef.current !== taskId) {
      // Another task is shown in the same field; start from its title.
      shownTaskIdRef.current = taskId;
      hasUnsavedRef.current = false;
      form.reset({ title: task?.title ?? "" });
      return;
    }
    syncFromServer();
  }, [task, taskId, form, syncFromServer]);

  // One request at a time, so responses cannot arrive out of order. Text
  // typed while a request runs is sent once it finishes.
  const save = useCallback(
    async (pending: PendingSave) => {
      if (isSavingRef.current) {
        queuedSaveRef.current = pending;
        return;
      }
      isSavingRef.current = true;
      let current: PendingSave | null = pending;
      try {
        while (current) {
          let saved = true;
          try {
            await updateTaskRef.current({
              ...current.task,
              title: current.title,
            });
          } catch (error) {
            saved = false;
            console.error("Failed to update title:", error);
          }
          const finished: PendingSave = current;
          current = queuedSaveRef.current;
          queuedSaveRef.current = null;
          if (
            saved &&
            !current &&
            finished.task.id === taskRef.current?.id &&
            form.getValues("title") === finished.title
          )
            hasUnsavedRef.current = false;
        }
      } finally {
        isSavingRef.current = false;
      }
      syncFromServer();
    },
    [form, syncFromServer],
  );

  const debouncedSave = useMemo(
    () => debounce((pending: PendingSave) => save(pending), 800),
    [save],
  );

  const title = form.watch("title");
  const textareaRef = useAutoGrowTextarea(title);

  const handleTitleChange = useCallback(
    (value: string) => {
      const currentTask = taskRef.current;
      if (!currentTask) return;

      hasUnsavedRef.current = true;
      // Keep the task in the call, so a pending save cannot land on another
      // task if the field switches tasks before it runs.
      debouncedSave({ task: currentTask, title: value });
    },
    [debouncedSave],
  );

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <textarea
            {...field}
            data-task-action="title"
            ref={(element) => {
              field.ref(element);
              textareaRef.current = element;
            }}
            rows={1}
            placeholder={t("tasks:detail.titlePlaceholder")}
            readOnly={!canEdit}
            className={cn(
              "block h-auto w-full resize-none appearance-none overflow-hidden border-0 bg-transparent p-0 font-heading font-semibold text-2xl text-foreground leading-[1.25] tracking-[-0.02em] outline-none placeholder:text-foreground/45",
              size === "lg" && "sm:text-[1.75rem] sm:leading-[1.2]",
            )}
            onFocus={() => {
              isFocusedRef.current = true;
            }}
            onBlur={() => {
              isFocusedRef.current = false;
              field.onBlur();
              syncFromServer();
            }}
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
