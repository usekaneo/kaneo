import type { Context, ErrorHandler } from "hono";
import { Hono } from "hono";
import type { PluginHostEnv, PluginRoutesApp } from "../types";
import { readPluginRequestAuth } from "./request-auth";

function pluginErrorHandler(pluginId: string): ErrorHandler {
  return (error, c) => {
    const getResponse = (error as { getResponse?: unknown }).getResponse;
    if (typeof getResponse === "function") {
      return getResponse.call(error) as Response;
    }
    console.error(`[plugin:${pluginId}]`, error);
    return c.json({ message: "Internal Server Error" }, 500);
  };
}

function notFound(c: Context) {
  return c.json({ message: "Not found" }, 404);
}

export function pluginBasePath(pluginId: string): string {
  return `/api/plugins/${pluginId}`;
}

export function createPluginRoutesApp(pluginId: string): PluginRoutesApp {
  const app: PluginRoutesApp = new Hono<PluginHostEnv>().basePath(
    pluginBasePath(pluginId),
  );
  app.onError(pluginErrorHandler(pluginId));
  app.notFound(notFound);
  app.use("*", async (c, next) => {
    const auth = readPluginRequestAuth(c.req.raw);
    if (!auth?.userId) {
      return c.json({ message: "Unauthorized" }, 401);
    }
    c.set("userId", auth.userId);
    c.set("userEmail", auth.userEmail);
    c.set("user", auth.user);
    c.set("session", auth.session);
    if (auth.apiKey) c.set("apiKey", auth.apiKey);
    await next();
  });
  return app;
}

export function createPluginWebhooksApp(pluginId: string): Hono {
  const app = new Hono().basePath(`${pluginBasePath(pluginId)}/webhooks`);
  app.onError(pluginErrorHandler(pluginId));
  app.notFound(notFound);
  return app;
}
