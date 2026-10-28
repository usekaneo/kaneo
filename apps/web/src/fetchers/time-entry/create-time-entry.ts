import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

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
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();
  return data;
}

export default createTimeEntry;
