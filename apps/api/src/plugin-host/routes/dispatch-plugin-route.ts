import type { Context } from "hono";
import type { BaseVariables } from "../../openapi";
import { attachPluginRequestAuth } from "../context/request-auth";
import { pluginPathRest } from "../plugin-path";
import { getLoadedPlugin } from "../registry";

const RESERVED_SEGMENTS = new Set(["assets", "data", "workspace", "webhooks"]);

export async function dispatchPluginRoute(
  c: Context<{ Variables: BaseVariables }>,
): Promise<Response> {
  const plugin = getLoadedPlugin(c.req.param("pluginId") ?? "");
  const segment = pluginPathRest(c.req.path)?.[0] ?? "";
  if (!plugin?.server || RESERVED_SEGMENTS.has(segment)) {
    return c.json({ message: "Not found" }, 404);
  }

  attachPluginRequestAuth(c.req.raw, {
    userId: c.get("userId"),
    userEmail: c.get("userEmail"),
    user: c.get("user"),
    session: c.get("session"),
    apiKey: c.get("apiKey"),
  });
  return plugin.server.routes.fetch(c.req.raw, c.env);
}
