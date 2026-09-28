import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";
import type Task from "@/types/task";

type UpdateTaskPriorityValue = InferRequestType<
  (typeof client)["task"]["priority"][":id"]["$put"]
>["json"]["priority"];

async function updateTaskPriority(taskId: string, task: Task) {
  const response = await client.task.priority[":id"].$put({
    param: { id: taskId },
    json: {
      priority: (task.priority || "") as UpdateTaskPriorityValue,
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default updateTaskPriority;
