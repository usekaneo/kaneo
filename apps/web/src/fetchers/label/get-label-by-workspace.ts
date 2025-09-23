import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

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
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  return data;
}

export default getLabelsByTask;
