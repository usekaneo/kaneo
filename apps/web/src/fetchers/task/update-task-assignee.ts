import type Task from "@/types/task";
import { client } from "@kaneo/libs";

async function updateTaskAssignee(taskId: string, task: Task) {
  const response = await client.task.assignee[":id"].$put({
    param: { id: taskId },
    json: {
      userId: task.userId || "",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default updateTaskAssignee;
