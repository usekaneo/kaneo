import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetItemTypesRequest = InferRequestType<
  (typeof client)["item-type"]["workspace"][":workspaceId"]["$get"]
>["param"];

async function getItemTypes({ workspaceId }: GetItemTypesRequest) {
  const response = await client["item-type"].workspace[":workspaceId"].$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getItemTypes;
