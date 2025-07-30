import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type AssignLabelToTaskRequest = InferRequestType<
  (typeof client)["label"]["assign"]["$post"]
>["json"];

async function assignLabelToTask({
  taskId,
  labelId,
}: AssignLabelToTaskRequest) {
  const response = await client.label.assign.$post({
    json: {
      taskId,
      labelId,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  return data;
}

export default assignLabelToTask;
