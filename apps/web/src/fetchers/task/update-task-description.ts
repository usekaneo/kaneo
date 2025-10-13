import { client } from "@kaneo/libs";
import type Task from "@/types/task";

async function updateTaskDescription(taskId: string, task: Task) {
  const response = await client.task.description[":id"].$put({
    param: { id: taskId },
    json: {
      description: task.description || "",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default updateTaskDescription;
