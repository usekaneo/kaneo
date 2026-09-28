import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type Task from "@/types/task";

async function updateTaskTitle(taskId: string, task: Task) {
  const response = await client.task.title[":id"].$put({
    param: { id: taskId },
    json: {
      title: task.title || "",
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default updateTaskTitle;
