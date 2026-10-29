import { builtinModules } from "node:module";
import { filterWarnings } from "./bundler-warnings.js";
import { jsxOptions } from "./jsx-options.js";
import type { PluginEntries } from "./entries.js";
import type { ViteConfig, ViteFlavor } from "./load-vite.js";

const NODE_TARGET = "node22";

export function createNodeConfig(
  root: string,
  entries: PluginEntries,
  flavor: ViteFlavor,
  watch: boolean,
): ViteConfig {
  const input: Record<string, string> = { index: entries.index };
  if (entries.server) input.server = entries.server;

  return {
    root,
    mode: "production",
    logLevel: "warn",
    clearScreen: false,
    publicDir: false,
    ...jsxOptions(flavor),
    ssr: { target: "node", noExternal: true },
    build: {
      ssr: true,
      outDir: "dist",
      emptyOutDir: false,
      copyPublicDir: false,
      target: NODE_TARGET,
      watch: watch ? {} : null,
      [flavor.bundlerOptionsKey]: {
        input,
        preserveEntrySignatures: "strict",
        onwarn: filterWarnings,
        external: [/^node:/, ...builtinModules],
        output: {
          format: "es",
          entryFileNames: "[name].js",
          chunkFileNames: "chunks/[name]-[hash].js",
        },
      },
    },
  };
}
