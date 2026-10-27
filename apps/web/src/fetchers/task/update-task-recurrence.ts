import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { TaskRecurrence } from "@/types/task/recurrence";

async function updateTaskRecurrence(
  taskId: string,
  recurrence: TaskRecurrence | null,
) {
  const response = await client.task.recurrence[":id"].$put({
    param: { id: taskId },
    json: { recurrence },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default updateTaskRecurrence;
