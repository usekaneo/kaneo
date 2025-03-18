import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import useGetTask from "@/hooks/queries/task/use-get-task";
import debounce from "@/lib/debounce";
import { Route } from "@/routes/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Form, FormField } from "../ui/form";

const taskTitleSchema = z.object({
  title: z.string().min(1),
});

function TaskTitle({
  setIsSaving,
}: { setIsSaving: (isSaving: boolean) => void }) {
  const { taskId } = Route.useParams();
  const { data: task } = useGetTask(taskId);
  const { mutateAsync: updateTask } = useUpdateTask();
  const form = useForm<z.infer<typeof taskTitleSchema>>({
    values: {
      title: task?.title || "",
    },
  });

  const debouncedUpdate = debounce(async (value: string) => {
    if (!task) return;

    setIsSaving(true);
    try {
      await updateTask({
        ...task,
        title: value,
        userEmail: task.userEmail || "",
        status: task.status || "",
        dueDate: task.dueDate || new Date(),
        priority: task.priority || "",
        position: task.position || 0,
      });
      toast.success("Task title updated", { duration: 2000 });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update task title",
      );
    } finally {
      setIsSaving(false);
    }
  }, 1000);

  async function handleTitleChange(value: string) {
    debouncedUpdate(value);
  }

  return (
    <div className="flex items-center gap-2">
      <Form {...form}>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <input
              type="text"
              className="w-full text-sm font-medium bg-transparent border-none focus:outline-none focus:ring-0 text-zinc-900 dark:text-zinc-100 p-0"
              {...field}
              onChange={(e) => {
                field.onChange(e);
                handleTitleChange(e.target.value);
              }}
            />
          )}
        />
      </Form>
    </div>
  );
}

export default TaskTitle;
