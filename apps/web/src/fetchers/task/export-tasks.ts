import { trpcClient } from "@/utils/trpc";

async function exportTasks(projectId: string) {
  return await trpcClient.task.export.query({ projectId });
}

export default exportTasks;
