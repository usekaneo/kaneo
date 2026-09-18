import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";

export type ListTimeEntriesRequest = InferRequestType<
  (typeof client)["time-entry"]["$get"]
>["query"];

export type TimeEntryDetail = InferResponseType<
  (typeof client)["time-entry"]["$get"],
  200
>[number];

async function listTimeEntries(query: ListTimeEntriesRequest) {
  const response = await client["time-entry"].$get({ query });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default listTimeEntries;
