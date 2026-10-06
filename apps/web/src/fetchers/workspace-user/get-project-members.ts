import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export type GetProjectMembersRequest = {
  workspaceId: string;
  projectId: string;
};

async function getProjectMembers({
  workspaceId,
  projectId,
}: GetProjectMembersRequest) {
  const response = await client.workspace[":workspaceId"].members.$get({
    param: { workspaceId },
    query: { projectId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getProjectMembers;
