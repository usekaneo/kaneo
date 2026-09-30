import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type DeleteLabelRequest = InferRequestType<
  (typeof client)["label"][":id"]["$delete"]
>["param"];

async function deleteLabel({ id }: DeleteLabelRequest) {
  let busyRetries = 0;
  for (;;) {
    const response = await client.label[":id"].$delete({ param: { id } });
    if (response.status === 429 && busyRetries < 5) {
      busyRetries++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }
    if (!response.ok)
      throw new HttpError(response.status, await response.text());
    const data = await response.json();
    if (response.status !== 202) return data;
    busyRetries = 0;
    // Each successful step persists its progress. Continue the same operation;
    // a later call with this ID also resumes after a failed or closed client.
  }
}
export default deleteLabel;
