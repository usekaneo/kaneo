import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateQuickTaskRequest = InferRequestType<
  (typeof client)["task"]["workspace"][":workspaceId"]["$post"]
>["json"] & { workspaceId: string };

async function createQuickTask({
  workspaceId,
  ...json
}: CreateQuickTaskRequest) {
  const response = await client.task.workspace[":workspaceId"].$post({
    param: { workspaceId },
    json,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createQuickTask;
