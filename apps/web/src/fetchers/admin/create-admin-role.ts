import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { AdminRoleValues } from "./role-types";

export async function createAdminRole(json: AdminRoleValues) {
  const response = await client.admin.roles.$post({ json });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
