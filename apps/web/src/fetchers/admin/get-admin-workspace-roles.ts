import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getAdminWorkspaceRoles(workspaceId: string) {
  const response = await client.admin.workspaces[":workspaceId"].roles.$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}
