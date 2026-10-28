import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getAdminSettings() {
  const response = await client.admin.settings.$get();

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
