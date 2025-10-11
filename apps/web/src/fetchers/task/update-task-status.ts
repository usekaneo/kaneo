import { client } from "@kaneo/libs";
import type Task from "@/types/task";

async function updateTaskStatus(taskId: string, task: Task) {
  const response = await client.task.status[":id"].$put({
    param: { id: taskId },
    json: {
      status: task.status || "",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default updateTaskStatus;
