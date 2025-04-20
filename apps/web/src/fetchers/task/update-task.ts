import type Task from "@/types/task";
import { client } from "@kaneo/libs";

async function updateTask(taskId: string, task: Task) {
  const response = await client.task[":id"].$put({
    param: { id: taskId },
    json: {
      userEmail: task.userEmail || "",
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority || "",
      dueDate: task.dueDate?.toString() || new Date().toString(),
      position: task.position || 0,
      projectId: task.projectId,
    },
  });

  const data = await response.json();

  return data;
}

export default updateTask;
