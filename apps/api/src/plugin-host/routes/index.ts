import type { MiddlewareHandler } from "hono";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../../openapi";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";
import { workspaceAccess } from "../../utils/workspace-access-middleware";
import { listPlugins } from "../controllers/list-plugins";
import { updateWorkspacePlugin } from "../controllers/update-workspace-plugin";
import {
  pluginListSchema,
  pluginSettingsErrorSchema,
  workspacePluginStateSchema,
} from "./response";
import {
  listPluginsQuery,
  pluginWorkspaceParams,
  updateWorkspacePluginBody,
} from "./schema";

const workspaceAccessWhenQueried: MiddlewareHandler = async (c, next) =>
  c.req.query("workspaceId")
    ? workspaceAccess.fromQuery("workspaceId")(c, next)
    : next();

const listPluginsRoute = createRoute({
  method: "get",
  operationId: "listPlugins",
  path: "/",
  tags: ["Plugins"],
  summary: "List plugins",
  description:
    "List the plugins installed on this instance. With workspaceId, each plugin also includes whether it is enabled in that workspace and its settings. Secret settings are never returned.",
  middleware: [workspaceAccessWhenQueried] as const,
  request: { query: listPluginsQuery },
  responses: {
    200: jsonResponse("Installed plugins", pluginListSchema),
    400: errorResponse("Invalid query"),
    403: errorResponse("No access to the workspace"),
  },
});

const updateWorkspacePluginRoute = createRoute({
  method: "put",
  operationId: "updateWorkspacePlugin",
  path: "/{pluginId}/workspace/{workspaceId}",
  tags: ["Plugins"],
  summary: "Update a plugin in a workspace",
  description:
    "Enable or disable a plugin in a workspace and save its settings. Omitted fields keep their current value. Enabling a plugin requires its required settings to be filled in.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: {
    params: pluginWorkspaceParams,
    body: {
      required: true,
      content: { "application/json": { schema: updateWorkspacePluginBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The plugin's state in the workspace",
      workspacePluginStateSchema,
    ),
    400: {
      description: "Invalid body, or settings that failed validation",
      content: {
        "application/json": { schema: pluginSettingsErrorSchema },
        "text/plain": { schema: z.string() },
      },
    },
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings permission",
    ),
    404: errorResponse("Plugin not found"),
  },
});

const plugins = apiRouter()
  .openapi(listPluginsRoute, async (c) =>
    c.json(await listPlugins(c.req.valid("query").workspaceId), 200),
  )
  .openapi(updateWorkspacePluginRoute, async (c) => {
    const { pluginId, workspaceId } = c.req.valid("param");
    const result = await updateWorkspacePlugin(
      pluginId,
      workspaceId,
      c.req.valid("json"),
    );
    if (!result.ok) {
      return c.json({ message: result.message, errors: result.errors }, 400);
    }
    return c.json(result.state, 200);
  });

export default plugins;
