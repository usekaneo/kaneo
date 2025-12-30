import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type UnarchiveProjectRequest = InferRequestType<
  (typeof client)["project"][":id"]["unarchive"]["$post"]
>["param"] &
  Partial<
    NonNullable<
      InferRequestType<
        (typeof client)["project"][":id"]["unarchive"]["$post"]
      >["query"]
    >
  >;

async function unarchiveProject({ id, workspaceId }: UnarchiveProjectRequest) {
  const response = await client.project[":id"].unarchive.$post({
    param: { id },
    query: workspaceId ? { workspaceId } : {},
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default unarchiveProject;
