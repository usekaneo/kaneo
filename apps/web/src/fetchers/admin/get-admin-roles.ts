import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getAdminRoles() {
  const response = await client.admin.roles.$get();

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()).roles;
}
