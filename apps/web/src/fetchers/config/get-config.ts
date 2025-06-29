import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type GetConfigResponse = InferResponseType<
  (typeof client)["config"]["$get"]
>;

export async function getConfig() {
  const response = await client.config.$get();

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  return data;
}
