import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateTaskRequest = InferRequestType<
  (typeof client)["task"][":projectId"]["$post"]
>["json"] &
  InferRequestType<(typeof client)["task"][":projectId"]["$post"]>["param"];

async function createTask(
  title: string,
  description: string,
  projectId: string,
  userId: string,
  status: string,
  dueDate: Date | undefined,
  priority: string,
) {
  const response = await client.task[":projectId"].$post({
    json: {
      title,
      description,
      userId,
      status,
      dueDate: dueDate?.toISOString() || undefined,
      priority,
    },
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default createTask;
