import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { InstalledPluginsResponse } from "@/types/plugin";

async function getPlugins(
  workspaceId: string,
): Promise<InstalledPluginsResponse> {
  const response = await client.plugins.$get({ query: { workspaceId } });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return (await response.json()) as InstalledPluginsResponse;
}

export default getPlugins;
