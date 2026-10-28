import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { AdminSettingsChange } from "./settings-types";

export async function updateAdminSettings(json: AdminSettingsChange) {
  const response = await client.admin.settings.$patch({ json });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
