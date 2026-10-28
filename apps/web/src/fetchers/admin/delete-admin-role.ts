import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function deleteAdminRole(roleId: string) {
  const response = await client.admin.roles[":roleId"].$delete({
    param: { roleId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
