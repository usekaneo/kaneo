import type { PluginLogger } from "@kaneo/plugin-sdk/server";

export function createPluginLogger(pluginId: string): PluginLogger {
  const prefix = `[plugin:${pluginId}]`;
  return {
    info: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}
