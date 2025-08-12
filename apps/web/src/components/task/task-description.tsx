import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import useGetTask from "@/hooks/queries/task/use-get-task";
import debounce from "@/lib/debounce";
import { Route } from "@/routes/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId_";
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
      userId: task.userId || "",
      title: task.title || "",
      status: task.status || "",
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
      priority: task.priority || "",
      position: task.position || 0,
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
    <div className="space-y-2">
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm h-[300px]">
        <Form {...form}>
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <Editor
                value={field.value || ""}
                onChange={(value) => handleDescriptionChange(value)}
                placeholder="Add a description to help your team understand this task..."
              />
            )}
          />
        </Form>
      </div>
    </div>
  );
}

export default TaskDescription;
