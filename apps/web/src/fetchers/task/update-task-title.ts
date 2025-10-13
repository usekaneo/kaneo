import { client } from "@kaneo/libs";
import type Task from "@/types/task";

async function updateTaskTitle(taskId: string, task: Task) {
  const response = await client.task.title[":id"].$put({
    param: { id: taskId },
    json: {
      title: task.title || "",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default updateTaskTitle;
