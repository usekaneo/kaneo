import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { UpdateAdminUserRequest } from "./types";

export async function updateAdminUser({
  userId,
  ...json
}: UpdateAdminUserRequest) {
  const response = await client.admin.users[":userId"].$patch({
    param: { userId },
    json,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
