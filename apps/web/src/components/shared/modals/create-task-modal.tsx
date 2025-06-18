import { Editor } from "@/components/common/editor";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import useCreateTask from "@/hooks/mutations/task/use-create-task";
import useUpdateTask from "@/hooks/mutations/task/use-update-task";
import useGetActiveWorkspaceUsers from "@/hooks/queries/workspace-users/use-active-workspace-users";
import useProjectStore from "@/store/project";
import useWorkspaceStore from "@/store/workspace";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import * as Dialog from "@radix-ui/react-dialog";
import { produce } from "immer";
import { Flag, UserIcon, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";
import { Select } from "../../ui/select";

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  status?: string;
}

const taskSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  email: z.string(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

function CreateTaskModal({ open, onClose, status }: CreateTaskModalProps) {
  const { project, setProject } = useProjectStore();
  const { workspace } = useWorkspaceStore();
  const { mutate: updateTask } = useUpdateTask();
  const { data: users } = useGetActiveWorkspaceUsers({
    workspaceId: workspace?.id ?? "",
  });

  const form = useForm<TaskFormValues>({
    resolver: standardSchemaResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "low",
      email: "",
    },
  });
  const { mutateAsync } = useCreateTask();

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const onSubmit = async (data: TaskFormValues) => {
    if (!project?.id || !workspace?.id) return;

    try {
      const taskStatus = status ?? "to-do";

      const newTask = await mutateAsync({
        title: data.title.trim(),
        description: data.description?.trim() || "",
        userEmail: data.email,
        priority: data.priority,
        projectId: project?.id,
        dueDate: new Date().toISOString(),
        status: taskStatus,
      });

      const updatedProject = produce(project, (draft) => {
        if (newTask.status !== "planned" && newTask.status !== "archived") {
          const targetColumn = draft.columns?.find(
            (col) => col.id === newTask.status,
          );
          if (targetColumn) {
            targetColumn.tasks.push({
              ...newTask,
              assigneeEmail: data.email,
              assigneeName: data.email,
              position: 0,
            });
          }
        }
      });

      setProject(updatedProject);
      updateTask({ ...newTask, position: 0 });
      toast.success("Task created successfully");

      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create task",
      );
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh]">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl flex flex-col h-full max-h-[90vh]">
            <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <Dialog.Title className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                New Task
              </Dialog.Title>
              <Dialog.Close
                asChild
                tabIndex={-1}
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              >
                <X size={20} />
              </Dialog.Close>
            </div>

            <div className="overflow-y-auto flex-grow">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="p-4">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="block text-sm font-medium text-zinc-900 dark:text-zinc-300 mb-1">
                            Title
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              autoFocus
                              placeholder="Task title"
                              className="bg-white dark:bg-zinc-800/50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="block text-sm font-medium text-zinc-900 dark:text-zinc-300 mb-1">
                            Description
                          </FormLabel>
                          <FormControl>
                            <div className="border border-zinc-200 dark:border-zinc-700/50 rounded-md overflow-hidden">
                              <div className="max-h-[300px] overflow-y-auto">
                                <Editor
                                  value={field.value || ""}
                                  onChange={(value) => field.onChange(value)}
                                  placeholder="Add a detailed description..."
                                />
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="block text-sm font-medium text-zinc-900 dark:text-zinc-300 mb-1">
                            Asignees
                          </FormLabel>
                          <FormControl>
                            <Select
                              {...field}
                              options={[
                                {
                                  value: "",
                                  label: "Unassigned",
                                  icon: (
                                    <UserIcon className="w-4 h-4 text-zinc-400" />
                                  ),
                                },
                                ...(users ?? []).map((user) => ({
                                  value: user.userEmail ?? "",
                                  label: user.userName ?? "",
                                })),
                              ]}
                              placeholder="Select assignee"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="block text-sm font-medium text-zinc-900 dark:text-zinc-300 mb-1">
                            Priority
                          </FormLabel>
                          <FormControl>
                            <Select
                              {...field}
                              options={[
                                {
                                  value: "low",
                                  label: "Low",
                                  icon: (
                                    <Flag className="w-4 h-4 text-blue-500" />
                                  ),
                                },
                                {
                                  value: "medium",
                                  label: "Medium",
                                  icon: (
                                    <Flag className="w-4 h-4 text-yellow-500" />
                                  ),
                                },
                                {
                                  value: "high",
                                  label: "High",
                                  icon: (
                                    <Flag className="w-4 h-4 text-orange-500" />
                                  ),
                                },
                                {
                                  value: "urgent",
                                  label: "Urgent",
                                  icon: (
                                    <Flag className="w-4 h-4 text-red-500" />
                                  ),
                                },
                              ]}
                              placeholder="Select priority"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <Dialog.Close asChild>
                      <Button
                        type="button"
                        className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                      >
                        Cancel
                      </Button>
                    </Dialog.Close>
                    <Button
                      type="submit"
                      className="bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                    >
                      Create Task
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default CreateTaskModal;
