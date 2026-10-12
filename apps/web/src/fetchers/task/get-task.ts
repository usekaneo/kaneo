import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type GetTaskRequest = InferRequestType<
  (typeof client)["task"][":id"]["$get"]
>["param"];

async function getTask(taskId: string, view: "detail" | "board" = "detail") {
  const response = await client.task[":id"].$get({
    param: { id: taskId },
    query: { view },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();

  return data;
}

export default getTask;
