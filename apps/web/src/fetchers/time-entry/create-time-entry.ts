import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateTimeEntryRequest = InferRequestType<
  (typeof client)["time-entry"]["$post"]
>["json"];

async function createTimeEntry({
  taskId,
  description,
  startTime,
}: CreateTimeEntryRequest) {
  const response = await client["time-entry"].$post({
    json: {
      taskId,
      description,
      startTime,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  return data;
}

export default createTimeEntry;
