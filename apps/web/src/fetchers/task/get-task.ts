import { trpcClient } from "@/utils/trpc";

async function getTask(taskId: string) {
  return await trpcClient.task.get.query({ id: taskId });
}

export default getTask;
