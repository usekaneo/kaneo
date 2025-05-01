import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type DeleteLabelRequest = InferRequestType<
  (typeof client)["label"][":id"]["$delete"]
>["param"];

async function deleteLabel({ id }: DeleteLabelRequest) {
  const response = await client.label[":id"].$delete({
    param: { id },
  });

  const data = await response.json();
  return data;
}

export default deleteLabel;
