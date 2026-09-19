import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type DeleteLabelRequest = InferRequestType<
  (typeof client)["label"][":id"]["$delete"]
>["param"];

async function deleteLabel({ id }: DeleteLabelRequest) {
  const response = await client.label[":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default deleteLabel;
