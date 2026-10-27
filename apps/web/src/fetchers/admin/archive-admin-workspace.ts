import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function archiveAdminWorkspace(workspaceId: string) {
  const response = await client.admin.workspaces[":workspaceId"].archive.$post({
    param: { workspaceId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
