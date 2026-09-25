import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type UpdateLabelRequest = InferRequestType<
  (typeof client)["label"][":id"]["$put"]
>["json"] &
  InferRequestType<(typeof client)["label"][":id"]["$put"]>["param"];

async function updateLabel({ id, name, color }: UpdateLabelRequest) {
  const response = await client.label[":id"].$put({
    param: { id },
    json: { name, color },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();
  return data;
}

export default updateLabel;
