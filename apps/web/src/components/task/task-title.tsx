import { useCallback, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Form, FormField } from "@/components/ui/form";
import { useUpdateTaskTitle } from "@/hooks/mutations/task/use-update-task-title";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { useAutoGrowTextarea } from "@/hooks/use-auto-grow-textarea";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { createDescriptionSaveQueue } from "@/lib/description-save-queue";
import { stripLineBreaks } from "@/lib/strip-line-breaks";
import { toast } from "@/lib/toast";

const titleSaveQueue = createDescriptionSaveQueue(0);

type TaskTitleProps = {
  taskId: string;
  size?: "md" | "lg";
};

export default function TaskTitle({ taskId, size = "md" }: TaskTitleProps) {
  const { t } = useTranslation();
  const { data: task } = useGetTask(taskId);
  const { mutateAsync: updateTaskTitle } = useUpdateTaskTitle();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const taskRef = useRef(task);
  const updateTaskRef = useRef(updateTaskTitle);
  const tRef = useRef(t);
  const acknowledgedTitleRef = useRef(task?.title ?? "");
  const pendingTitleRef = useRef<string | null>(null);

  useEffect(() => {
    taskRef.current = task;
    updateTaskRef.current = updateTaskTitle;
    tRef.current = t;
  }, [task, updateTaskTitle, t]);

  const form = useForm<{ title: string }>({
    defaultValues: { title: task?.title ?? "" },
  });
  const { reset } = form;
  const fetchedTaskId = task?.id;
  const fetchedTitle = task?.title ?? "";

  useEffect(() => {
    acknowledgedTitleRef.current = fetchedTitle;
    if (
      pendingTitleRef.current === null &&
      !(fetchedTaskId && titleSaveQueue.get(fetchedTaskId))
    ) {
      reset({ title: fetchedTitle });
    }
  }, [fetchedTaskId, fetchedTitle, reset]);

  const commitTitle = useCallback(() => {
    const title = pendingTitleRef.current;
    const currentTask = taskRef.current;
    if (title === null || !currentTask) return;
    pendingTitleRef.current = null;

    const queued = titleSaveQueue.get(currentTask.id);
    const lastTitle =
      queued && queued.state !== "failed"
        ? queued.value
        : acknowledgedTitleRef.current;
    if (title === lastTitle) return;

    titleSaveQueue.schedule(currentTask.id, title, async (value) => {
      try {
        await updateTaskRef.current({ ...currentTask, title: value });
        if (taskRef.current?.id === currentTask.id)
          acknowledgedTitleRef.current = value;
      } catch (error) {
        toast.error(tRef.current("tasks:detail.editor.saveFailed"));
        // Only restore this editor's draft if it still shows the same task.
        if (
          taskRef.current?.id === currentTask.id &&
          titleSaveQueue.get(currentTask.id)?.value === value
        )
          pendingTitleRef.current ??= value;
        throw error;
      }
    });
  }, []);

  useEffect(() => {
    const warnIfUnsaved = (event: BeforeUnloadEvent) => {
      const currentTask = taskRef.current;
      if (!currentTask) return;
      const pending = pendingTitleRef.current;
      if (
        (pending !== null && pending !== acknowledgedTitleRef.current) ||
        titleSaveQueue.get(currentTask.id)
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", warnIfUnsaved);
    return () => window.removeEventListener("beforeunload", warnIfUnsaved);
  }, []);

  // Closing or switching tasks doesn't always fire blur, so save here too.
  useEffect(() => () => commitTitle(), [taskId, commitTitle]);

  const title = form.watch("title");
  const textareaRef = useAutoGrowTextarea(title);

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
              pendingTitleRef.current = value;
            }}
            onBlur={() => {
              field.onBlur();
              commitTitle();
            }}
          />
        )}
      />
    </Form>
  );
}
