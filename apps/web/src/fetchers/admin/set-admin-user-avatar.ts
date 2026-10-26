import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { SetAdminUserAvatarRequest } from "./types";

export async function setAdminUserAvatar({
  userId,
  contentType,
  data,
}: SetAdminUserAvatarRequest) {
  const response = await client.admin.users[":userId"].avatar.$put({
    param: { userId },
    json: { contentType, data },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
