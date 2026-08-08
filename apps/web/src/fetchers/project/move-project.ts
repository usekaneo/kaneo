import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type MoveProjectRequest = InferRequestType<
  (typeof client)["project"][":id"]["move"]["$put"]
>["json"] &
  InferRequestType<(typeof client)["project"][":id"]["move"]["$put"]>["param"];

async function moveProject({ id, workspaceId }: MoveProjectRequest) {
  const response = await client.project[":id"].move.$put({
    param: { id },
    json: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default moveProject;
