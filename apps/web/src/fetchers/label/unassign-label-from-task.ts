import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type UnassignLabelFromTaskRequest = InferRequestType<
  (typeof client)["label"]["assign"]["$delete"]
>["json"];

async function unassignLabelFromTask({
  taskId,
  labelId,
}: UnassignLabelFromTaskRequest) {
  const response = await client.label.assign.$delete({
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

export default unassignLabelFromTask;
