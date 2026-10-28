import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function sendAdminUserPasswordReset(userId: string) {
  const response = await client.admin.users[":userId"][
    "password-reset-email"
  ].$post({
    param: { userId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
