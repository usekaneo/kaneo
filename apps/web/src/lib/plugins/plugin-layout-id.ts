export type PluginLayoutId = `plugin:${string}:${string}`;

export type PluginViewRef = {
  pluginId: string;
  viewId: string;
};

const PREFIX = "plugin:";

export function pluginLayoutId({
  pluginId,
  viewId,
}: PluginViewRef): PluginLayoutId {
  return `plugin:${pluginId}:${viewId}`;
}

export function isPluginLayoutId(value: unknown): value is PluginLayoutId {
  return parsePluginLayoutId(value) !== null;
}

export function parsePluginLayoutId(value: unknown): PluginViewRef | null {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return null;
  const rest = value.slice(PREFIX.length);
  const separator = rest.indexOf(":");
  if (separator <= 0 || separator === rest.length - 1) return null;
  return {
    pluginId: rest.slice(0, separator),
    viewId: rest.slice(separator + 1),
  };
}
