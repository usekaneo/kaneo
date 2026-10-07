import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

type UpdateMemberProjectAccessEndpoint =
  (typeof client)["workspace"][":workspaceId"]["members"][":userId"]["project-access"]["$put"];

export type UpdateMemberProjectAccessRequest =
  InferRequestType<UpdateMemberProjectAccessEndpoint>["param"] &
    InferRequestType<UpdateMemberProjectAccessEndpoint>["json"];

async function updateMemberProjectAccess({
  workspaceId,
  userId,
  projectAccess,
  projectIds,
}: UpdateMemberProjectAccessRequest) {
  const response = await client.workspace[":workspaceId"].members[":userId"][
    "project-access"
  ].$put({
    param: { workspaceId, userId },
    json: { projectAccess, projectIds },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default updateMemberProjectAccess;
