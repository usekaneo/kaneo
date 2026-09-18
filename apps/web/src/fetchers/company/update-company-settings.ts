import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type UpdateCompanySettingsRequest = InferRequestType<
  (typeof client)["company"]["settings"]["$put"]
>["json"];

async function updateCompanySettings(json: UpdateCompanySettingsRequest) {
  const response = await client.company.settings.$put({ json });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default updateCompanySettings;
