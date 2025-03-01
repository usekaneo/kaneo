import type { Task } from "@/types/project";
import { api } from "@kaneo/libs";

async function updateTask(taskId: string, task: Task) {
  const response = await api.task({ taskId }).update.put(task);

  if (response.status !== 200) {
    throw new Error("Failed to update task");
  }

  return response.data;
}

export default updateTask;
