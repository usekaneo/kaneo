import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type DeleteTaskRequest = InferRequestType<
  (typeof client)["task"][":id"]["$delete"]
>["param"];

async function deleteTask(taskId: string) {
  const response = await client.task[":id"].$delete({ param: { id: taskId } });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default deleteTask;
