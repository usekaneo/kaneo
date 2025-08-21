import { trpcClient } from "@/utils/trpc";

async function deleteTask(taskId: string) {
  return await trpcClient.task.delete.mutate({ id: taskId });
}

export default deleteTask;
