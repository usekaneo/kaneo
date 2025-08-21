import { trpcClient } from "@/utils/trpc";

async function getTimeEntriesByTaskId(taskId: string) {
  return await trpcClient.timeEntry.getByTaskId.query({ taskId });
}

export default getTimeEntriesByTaskId;
