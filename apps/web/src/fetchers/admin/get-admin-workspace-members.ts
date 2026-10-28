import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getAdminWorkspaceMembers(workspaceId: string) {
  const response = await client.admin.workspaces[":workspaceId"].members.$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
