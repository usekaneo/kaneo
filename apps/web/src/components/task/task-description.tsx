import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import useGetTask from "@/hooks/queries/task/use-get-task";
import debounce from "@/lib/debounce";
import { Route } from "@/routes/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Editor } from "../common/editor";
import { Form, FormField } from "../ui/form";

interface TaskDescriptionProps {
  setIsSaving: (isSaving: boolean) => void;
}

function TaskDescription({ setIsSaving }: TaskDescriptionProps) {
  const { taskId } = Route.useParams();
  const { data: task } = useGetTask(taskId);
  const { mutateAsync: updateTask } = useUpdateTask();

  const form = useForm<{
    description: string;
  }>({
    shouldUnregister: true,
    values: {
      description: task?.description || "",
    },
  });

  const debouncedUpdate = debounce(async (value: string) => {
    if (!task) return;

    setIsSaving(true);
    await updateTask({
      ...task,
      description: value,
      assigneeName: task.userEmail || "",
    });
    setIsSaving(false);
  }, 1000);

  async function handleDescriptionChange(value: string) {
    debouncedUpdate(value);
  }

  useEffect(() => {
    return () => {
      form.reset();
    };
  }, [form]);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200/50 dark:border-zinc-800/50 pb-1 px-1">
      <Form {...form}>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <Editor
              value={field.value || ""}
              onChange={(value) => handleDescriptionChange(value)}
              placeholder="Use the toolbar to format your description..."
            />
          )}
        />
      </Form>
    </div>
  );
}

export default TaskDescription;
