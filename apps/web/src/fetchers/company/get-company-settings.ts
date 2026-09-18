import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type CompanySettings = InferResponseType<
  (typeof client)["company"]["settings"]["$get"],
  200
>;

async function getCompanySettings(workspaceId: string) {
  const response = await client.company.settings.$get({
    query: { workspaceId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default getCompanySettings;
