import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type GetBillingResponse = InferResponseType<
  (typeof client)["billing"][":workspaceId"]["$get"],
  200
>;

export async function getBilling(workspaceId: string) {
  const response = await client.billing[":workspaceId"].$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}
