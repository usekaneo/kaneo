import type {
  PluginEvent,
  PluginEventName,
  SettingsSchema,
} from "@kaneo/plugin-sdk";
import type { PluginWebAssets } from "@kaneo/plugin-loader";
import type { Hono } from "hono";
import type { BaseVariables } from "../openapi";

export type PluginHostEnv = {
  Variables: BaseVariables & { workspaceId: string };
};

export type PluginRoutesApp = Hono<PluginHostEnv>;

export type PluginEventHandlers = Map<
  PluginEventName,
  Array<(event: PluginEvent) => void | Promise<void>>
>;

export type PluginServerRuntime = {
  routes: PluginRoutesApp;
  webhooks: Hono;
  handlers: PluginEventHandlers;
};

export type LoadedPlugin = {
  id: string;
  name: string;
  packageName: string;
  version: string;
  description: string | null;
  official: boolean;
  settings: SettingsSchema;
  options: unknown;
  server: PluginServerRuntime | null;
  web: PluginWebAssets | null;
};
