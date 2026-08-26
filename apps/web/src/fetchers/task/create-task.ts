import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateTaskRequest = InferRequestType<
  (typeof client)["task"][":projectId"]["$post"]
>["json"] &
  InferRequestType<(typeof client)["task"][":projectId"]["$post"]>["param"];

async function createTask({
  title,
  description,
  projectId,
  userId,
  status,
  startDate,
  dueDate,
  priority,
  taskType,
}: CreateTaskRequest) {
  if (!projectId) {
    throw new Error("No project selected for task creation");
  }

  const response = await client.task[":projectId"].$post({
    json: {
      title,
      description,
      userId,
      status,
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
      priority,
      taskType,
    },
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createTask;
