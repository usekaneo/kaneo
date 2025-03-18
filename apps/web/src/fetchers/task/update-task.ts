import type { Task } from "@/types/project";
import { api } from "@kaneo/libs";

async function updateTask(taskId: string, task: Task) {
  const response = await api.task({ taskId }).update.put({
    userEmail: task.userEmail || "",
    title: task.title,
    description: task.description || "",
    status: task.status,
    projectId: task.projectId,
    priority: task.priority || "",
    dueDate: task.dueDate || new Date(),
    position: task.position || 0,
  });

  if (response.status !== 200) {
    throw new Error("Failed to update task");
  }

  return response.data;
}

export default updateTask;
