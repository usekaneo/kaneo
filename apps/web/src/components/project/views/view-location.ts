import {
  isPluginLayoutId,
  parsePluginLayoutId,
} from "@/lib/plugins/plugin-layout-id";
import {
  PLUGIN_VIEW_PATH,
  PROJECT_ROUTE_PATHS,
  type ProjectRoute,
} from "./project-views";

export function viewLocation(
  route: ProjectRoute,
  workspaceId: string,
  projectId: string,
) {
  if (isPluginLayoutId(route)) {
    const plugin = parsePluginLayoutId(route);
    return {
      to: PLUGIN_VIEW_PATH,
      params: {
        workspaceId,
        projectId,
        pluginId: plugin?.pluginId ?? "",
        viewId: plugin?.viewId ?? "",
      },
    };
  }
  return {
    to: PROJECT_ROUTE_PATHS[route],
    params: { workspaceId, projectId },
  };
}
