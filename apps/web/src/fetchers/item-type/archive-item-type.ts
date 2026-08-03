import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type ArchiveItemTypeRequest = InferRequestType<
  (typeof client)["item-type"][":id"]["$delete"]
>["param"];

async function archiveItemType({ id }: ArchiveItemTypeRequest) {
  const response = await client["item-type"][":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default archiveItemType;
