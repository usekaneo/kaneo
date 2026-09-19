import { client } from "@kaneo/libs";
import type Task from "@/types/task";

async function updateTaskTimeEstimate(taskId: string, task: Task) {
  const response = await client.task["time-estimate"][":id"].$put({
    param: { id: taskId },
    json: {
      timeEstimate: task.timeEstimate || null,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default updateTaskTimeEstimate;
