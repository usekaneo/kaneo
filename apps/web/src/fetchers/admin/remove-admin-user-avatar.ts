import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function removeAdminUserAvatar(userId: string) {
  const response = await client.admin.users[":userId"].avatar.$delete({
    param: { userId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
