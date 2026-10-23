import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getWorkspaceDefaultLabels(workspaceId: string) {
  const response = await client.label.workspace[":workspaceId"][
    "project-defaults"
  ].$get({ param: { workspaceId } });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getWorkspaceDefaultLabels;
