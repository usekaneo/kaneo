import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

/** The signed-in user's instance permissions; empty for regular users. */
export async function getAdminAccess() {
  const response = await client.admin.access.$get();

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()).permissions;
}
