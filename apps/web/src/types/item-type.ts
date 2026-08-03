import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

type ItemTypeResponse = InferResponseType<
  (typeof client)["item-type"]["workspace"][":workspaceId"]["$get"],
  200
>[number];

export type ItemType = Pick<
  ItemTypeResponse,
  | "id"
  | "workspaceId"
  | "key"
  | "name"
  | "icon"
  | "description"
  | "position"
  | "archivedAt"
>;
