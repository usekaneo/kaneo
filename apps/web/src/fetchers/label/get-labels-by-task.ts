import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetLabelsByTaskRequest = InferRequestType<
  (typeof client)["label"]["task"][":taskId"]["$get"]
>["param"];

async function getLabelsByTask({ taskId }: GetLabelsByTaskRequest) {
  const response = await client.label.task[":taskId"].$get({
    param: {
      taskId,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  return data;
}

export default getLabelsByTask;
