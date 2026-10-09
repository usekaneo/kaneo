import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { AdminWorkspaceMemberRoleRequest } from "./workspace-types";

export async function updateAdminWorkspaceMemberRole({
  workspaceId,
  userId,
  role,
}: AdminWorkspaceMemberRoleRequest) {
  const response = await client.admin.workspaces[":workspaceId"].members[
    ":userId"
  ].role.$put({
    param: { workspaceId, userId },
    json: { role },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
