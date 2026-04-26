import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type GetIdTokenResponse = InferResponseType<
  (typeof client)["oauth"]["id-token"]["$get"]
>;

export async function getIdToken() {
  const response = await client.oauth["id-token"].$get();

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  return data;
}
