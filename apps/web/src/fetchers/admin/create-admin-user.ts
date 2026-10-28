import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { CreateAdminUserRequest } from "./types";

export async function createAdminUser(request: CreateAdminUserRequest) {
  const response = await client.admin.users.$post({ json: request });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
