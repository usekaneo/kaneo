import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { AdminRoleValues } from "./role-types";

export async function updateAdminRole({
  roleId,
  ...json
}: AdminRoleValues & { roleId: string }) {
  const response = await client.admin.roles[":roleId"].$put({
    param: { roleId },
    json,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
