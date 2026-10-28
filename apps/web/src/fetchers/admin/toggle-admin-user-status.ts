import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { ToggleAdminUserStatusRequest } from "./types";

export async function toggleAdminUserStatus({
  userId,
  deactivate,
}: ToggleAdminUserStatusRequest) {
  const user = client.admin.users[":userId"];
  const param = { param: { userId } };
  const response = deactivate
    ? await user.deactivate.$post(param)
    : await user.reactivate.$post(param);

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
