import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getAdminSystemStatus() {
  const response = await client.admin.system.$get();

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
