import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type GetLabelsByTaskRequest = InferRequestType<
  (typeof client)["label"]["workspace"][":workspaceId"]["$get"]
>["param"];

async function getLabelsByTask({ workspaceId }: GetLabelsByTaskRequest) {
  const response = await client.label.workspace[":workspaceId"].$get({
    param: {
      workspaceId,
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();
  return data;
}

export default getLabelsByTask;
