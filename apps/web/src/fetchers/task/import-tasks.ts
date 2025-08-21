import { trpcClient } from "@/utils/trpc";

export type TaskToImport = {
  title: string;
  description?: string;
  status: string;
  priority?: string;
  dueDate?: string;
  userId?: string | null;
};

async function importTasks(projectId: string, tasks: TaskToImport[]) {
  return await trpcClient.task.import.mutate({ projectId, tasks });
}

export default importTasks;
