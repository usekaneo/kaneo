import { client } from "@kaneo/libs";
import { toPluginApiError } from "@/lib/plugins/plugin-api-error";
import type {
  PluginWorkspaceState,
  UpdatePluginWorkspaceRequest,
} from "@/types/plugin";

async function updatePluginWorkspace(
  pluginId: string,
  workspaceId: string,
  json: UpdatePluginWorkspaceRequest,
): Promise<PluginWorkspaceState> {
  const response = await client.plugins[":pluginId"].workspace[
    ":workspaceId"
  ].$put({
    param: { pluginId, workspaceId },
    json,
  });

  if (!response.ok) {
    throw toPluginApiError(
      response.status,
      response.statusText,
      await response.text(),
    );
  }

  return (await response.json()) as PluginWorkspaceState;
}

export default updatePluginWorkspace;
