import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

type UpdateItemTypeEndpoint = (typeof client)["item-type"][":id"]["$put"];

export type UpdateItemTypeRequest =
  InferRequestType<UpdateItemTypeEndpoint>["json"] &
    InferRequestType<UpdateItemTypeEndpoint>["param"];

async function updateItemType({ id, ...json }: UpdateItemTypeRequest) {
  const response = await client["item-type"][":id"].$put({
    param: { id },
    json,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateItemType;
