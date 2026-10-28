import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function revokeAdminUserSession({
  userId,
  sessionId,
}: {
  userId: string;
  sessionId: string;
}) {
  const response = await client.admin.users[":userId"].sessions[
    ":sessionId"
  ].$delete({ param: { userId, sessionId } });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
