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
  userEmail: string,
  status: string,
  dueDate: Date,
  priority: string,
) {
  const response = await client.task[":projectId"].$post({
    json: {
      title,
      description,
      userEmail,
      status,
      dueDate: dueDate.toISOString(),
      priority,
    },
    param: { projectId },
  });

  const data = await response.json();

  return data;
}

export default createTask;
