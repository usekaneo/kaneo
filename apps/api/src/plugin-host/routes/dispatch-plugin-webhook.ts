import type { Context } from "hono";
import { getLoadedPlugin } from "../registry";

export async function dispatchPluginWebhook(c: Context): Promise<Response> {
  const plugin = getLoadedPlugin(c.req.param("pluginId") ?? "");
  if (!plugin?.server) {
    return c.json({ message: "Not found" }, 404);
  }
  return plugin.server.webhooks.fetch(c.req.raw, c.env);
}
