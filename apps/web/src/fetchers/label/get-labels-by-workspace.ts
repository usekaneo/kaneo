import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetLabelsByWorkspaceRequest = InferRequestType<
  (typeof client)["label"]["workspace"][":workspaceId"]["$get"]
>["param"];

async function getLabelsByWorkspace({
  workspaceId,
}: GetLabelsByWorkspaceRequest) {
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

export default getLabelsByWorkspace;
