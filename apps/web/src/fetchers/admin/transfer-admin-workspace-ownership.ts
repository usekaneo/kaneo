import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { AdminWorkspaceMemberTarget } from "./workspace-types";

export async function transferAdminWorkspaceOwnership({
  workspaceId,
  userId,
}: AdminWorkspaceMemberTarget) {
  const response = await client.admin.workspaces[":workspaceId"].owner.$put({
    param: { workspaceId },
    json: { userId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
