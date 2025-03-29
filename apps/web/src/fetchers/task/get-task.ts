import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetTaskRequest = InferRequestType<
  (typeof client)["task"][":id"]["$get"]
>["param"];

async function getTask(taskId: string) {
  const response = await client.task[":id"].$get({ param: { id: taskId } });

  const data = await response.json();

  return data;
}

export default getTask;
