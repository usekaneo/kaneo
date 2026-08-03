import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateItemTypeRequest = InferRequestType<
  (typeof client)["item-type"]["$post"]
>["json"];

async function createItemType(input: CreateItemTypeRequest) {
  const response = await client["item-type"].$post({ json: input });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createItemType;
