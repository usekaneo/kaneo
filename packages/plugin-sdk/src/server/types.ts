import type { Hono, MiddlewareHandler } from "hono";
import type { PluginEvent, PluginEventName } from "../events/types.js";
import type { SettingsSchema, SettingsValues } from "../settings/types.js";

export type PluginVariables = {
  userId: string;
  workspaceId: string;
};

export type PluginEnv = {
  Variables: PluginVariables;
};

export type PermissionRequirement = Partial<
  Record<"workspace" | "project" | "task" | "label", string[]>
>;

export type PluginGuards = {
  workspace(
    param?: string,
    permissions?: PermissionRequirement,
  ): MiddlewareHandler<PluginEnv>;
  project(
    param?: string,
    permissions?: PermissionRequirement,
  ): MiddlewareHandler<PluginEnv>;
  task(
    param?: string,
    permissions?: PermissionRequirement,
  ): MiddlewareHandler<PluginEnv>;
};

export type StorageEntry<T> = {
  key: string;
  value: T;
  updatedAt: string;
};

export type PluginStorage = {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list<T = unknown>(options?: {
    prefix?: string;
    limit?: number;
  }): Promise<StorageEntry<T>[]>;
};

export type PluginLogger = {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};

export type PluginEventHandler<E extends PluginEventName> = (
  event: PluginEvent<E>,
) => void | Promise<void>;

export type ServerContext<Options, Settings extends SettingsSchema> = {
  plugin: { id: string; version: string };
  options: Options;
  log: PluginLogger;
  routes: Hono<PluginEnv>;
  webhooks: Hono;
  guard: PluginGuards;
  on<E extends PluginEventName>(event: E, handler: PluginEventHandler<E>): void;
  storage(workspaceId: string): PluginStorage;
  settings(workspaceId: string): Promise<SettingsValues<Settings>>;
  enabledWorkspaces(): Promise<string[]>;
  schedule(name: string, cron: string, run: () => void | Promise<void>): void;
};

export type ServerPluginConfig<Options, Settings extends SettingsSchema> = {
  settings?: Settings;
  setup(kaneo: ServerContext<Options, Settings>): void | Promise<void>;
};

export type ServerPluginDefinition = {
  readonly kind: "kaneo-server";
  readonly apiVersion: number;
  readonly settings: SettingsSchema;
  readonly setup: (
    kaneo: ServerContext<unknown, SettingsSchema>,
  ) => void | Promise<void>;
};
