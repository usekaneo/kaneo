import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type ItemType = InferResponseType<
  (typeof client)["item-type"]["workspace"][":workspaceId"]["$get"],
  200
>[number];
