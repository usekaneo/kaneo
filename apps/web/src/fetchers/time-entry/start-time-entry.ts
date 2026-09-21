import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type StartTimeEntryRequest = InferRequestType<
  (typeof client)["time-entry"]["start"]["$post"]
>["json"];

async function startTimeEntry({
  taskId,
  description,
  billable,
}: StartTimeEntryRequest) {
  const response = await client["time-entry"].start.$post({
    json: {
      taskId,
      description,
      billable,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  return data;
}

export default startTimeEntry;
