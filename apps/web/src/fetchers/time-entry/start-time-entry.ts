import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

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
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();
  return data;
}

export default startTimeEntry;
