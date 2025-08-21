import type { Task } from "@/types";
import { trpcClient } from "@/utils/trpc";

async function updateTask(taskId: string, task: Task) {
  return await trpcClient.task.update.mutate({
    id: taskId,
    userId: task.userId ?? undefined,
    title: task.title,
    description: task.description || "",
    status: task.status,
    priority: task.priority || "",
    dueDate: task.dueDate || new Date(),
    position: task.position || 0,
    projectId: task.projectId,
  });
}

export default updateTask;
