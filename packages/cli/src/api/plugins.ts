import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

export const Plugin = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  packageName: Schema.String,
  version: Schema.String,
  description: Schema.NullOr(Schema.String),
  official: Schema.Boolean,
  workspace: Schema.NullOr(Schema.Struct({ enabled: Schema.Boolean })),
});
export type Plugin = typeof Plugin.Type;

const PluginList = Schema.Struct({ plugins: Schema.Array(Plugin) });

export const PluginDataPurge = Schema.Struct({
  storage: Schema.Number,
  workspaces: Schema.Number,
});
export type PluginDataPurge = typeof PluginDataPurge.Type;

export const listPlugins = Effect.fnUntraced(function* (workspaceId: string) {
  const api = yield* KaneoApi;
  const list = yield* api.request("GET", "/api/plugins", PluginList, {
    query: { workspaceId },
  });
  return list.plugins;
});

export const purgePluginData = Effect.fnUntraced(function* (pluginId: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "DELETE",
    `/api/plugins/${encodeURIComponent(pluginId)}/data`,
    PluginDataPurge,
  );
});
