import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function revokeUserSession(sessionId: string) {
  const response = await client.user.sessions[":sessionId"].$delete({
    param: { sessionId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
