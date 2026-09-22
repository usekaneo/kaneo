import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type Task from "@/types/task";

async function updateTaskTimeEstimate(taskId: string, task: Task) {
  const response = await client.task["time-estimate"][":id"].$put({
    param: { id: taskId },
    json: {
      timeEstimate: task.timeEstimate || null,
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default updateTaskTimeEstimate;
