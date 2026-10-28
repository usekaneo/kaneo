import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function revokeAdminUserApiKey({
  userId,
  apiKeyId,
}: {
  userId: string;
  apiKeyId: string;
}) {
  const response = await client.admin.users[":userId"]["api-keys"][
    ":apiKeyId"
  ].$delete({ param: { userId, apiKeyId } });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
