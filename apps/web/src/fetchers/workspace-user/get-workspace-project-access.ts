import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getWorkspaceProjectAccess(workspaceId: string) {
  const response = await client.workspace[":workspaceId"][
    "project-access"
  ].$get({ param: { workspaceId } });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getWorkspaceProjectAccess;
