import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function markAdminUserEmailVerified(userId: string) {
  const response = await client.admin.users[":userId"]["email-verified"].$put({
    param: { userId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
