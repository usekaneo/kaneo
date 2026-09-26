import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type UpdateTimeEntryRequest = InferRequestType<
  (typeof client)["time-entry"][":id"]["$put"]
>["json"] & {
  id: string;
};

async function updateTimeEntry({
  id,
  startTime,
  endTime,
  description,
}: UpdateTimeEntryRequest) {
  const response = await client["time-entry"][":id"].$put({
    param: { id },
    json: {
      startTime,
      endTime,
      description,
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();
  return data;
}

export default updateTimeEntry;
