import { trpcClient } from "@/utils/trpc";

async function getTasks(projectId: string) {
  return await trpcClient.task.list.query({ projectId });
}

export default getTasks;
