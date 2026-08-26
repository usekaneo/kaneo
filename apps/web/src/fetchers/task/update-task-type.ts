import { client } from "@kaneo/libs";
import type Task from "@/types/task";

async function updateTaskType(taskId: string, task: Task) {
  const response = await client.task.type[":id"].$patch({
    param: { id: taskId },
    json: {
      taskType: task.taskType ?? "feat",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateTaskType;
