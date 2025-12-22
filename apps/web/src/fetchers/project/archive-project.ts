import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type ArchiveProjectRequest = InferRequestType<
  (typeof client)["project"][":id"]["archive"]["$post"]
>["param"] &
  Partial<
    NonNullable<
      InferRequestType<
        (typeof client)["project"][":id"]["archive"]["$post"]
      >["query"]
    >
  >;

async function archiveProject({ id, workspaceId }: ArchiveProjectRequest) {
  const response = await client.project[":id"].archive.$post({
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

export default archiveProject;
