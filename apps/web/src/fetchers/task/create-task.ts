import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type CreateTaskRequest = InferRequestType<
  (typeof client)["task"][":projectId"]["$post"]
>["json"] &
  InferRequestType<(typeof client)["task"][":projectId"]["$post"]>["param"];

async function createTask(
  title: string,
  description: string,
  projectId: string,
  userId: string | undefined,
  status: string,
  startDate: Date | undefined,
  dueDate: Date | undefined,
  priority: CreateTaskRequest["priority"],
  customFields?: { fieldId: string; value: string }[],
) {
  if (!projectId) {
    throw new Error("No project selected for task creation");
  }

  const response = await client.task[":projectId"].$post({
    json: {
      title,
      description,
      ...(userId ? { userId } : {}),
      status,
      startDate: startDate?.toISOString() || undefined,
      dueDate: dueDate?.toISOString() || undefined,
      priority,
      customFields,
    },
    param: { projectId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default createTask;
