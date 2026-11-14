import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type ArchiveProjectRequest = InferRequestType<
  (typeof client)["project"][":id"]["archive"]["$put"]
>["param"];

async function archiveProject({ id }: ArchiveProjectRequest) {
  const response = await client.project[":id"].archive.$put({ param: { id } });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();

  return data;
}

export default archiveProject;
