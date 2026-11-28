import type { PluginPackage } from "../package/parse-plugin-package.js";

export type BuiltPlugin = {
  readonly id: string;
  readonly name: string;
  readonly packageName: string;
  readonly version: string;
  readonly engines: string | null;
};

export type BuiltFile = {
  readonly path: string;
  readonly bytes: number;
};

export type BuildResult = {
  readonly plugin: BuiltPlugin;
  readonly files: ReadonlyArray<BuiltFile>;
  readonly warnings: ReadonlyArray<string>;
};

export function describePlugin(plugin: PluginPackage): BuiltPlugin {
  return {
    id: plugin.id,
    name: plugin.name,
    packageName: plugin.packageName,
    version: plugin.version,
    engines: plugin.engines,
  };
}
