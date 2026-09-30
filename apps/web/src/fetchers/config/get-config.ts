import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type GetConfigResponse = InferResponseType<
  (typeof client)["config"]["$get"],
  200
>;

export async function getConfig() {
  const response = await client.config.$get();

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();
  return data;
}
