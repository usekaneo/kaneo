import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type GetBillingResponse = InferResponseType<
  (typeof client)["billing"][":workspaceId"]["$get"],
  200
>;

export async function getBilling(workspaceId: string) {
  const response = await client.billing[":workspaceId"].$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}
