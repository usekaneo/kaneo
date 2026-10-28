import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function sendAdminTestEmail() {
  const response = await client.admin.system["test-email"].$post();

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
