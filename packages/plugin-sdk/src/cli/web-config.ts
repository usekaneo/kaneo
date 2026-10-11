import { SHARED_MODULES } from "../shared-modules.js";
import { filterWarnings } from "./bundler-warnings.js";
import { jsxOptions } from "./jsx-options.js";
import type { ViteConfig, ViteFlavor } from "./load-vite.js";

export function createWebConfig(
  root: string,
  entry: string,
  flavor: ViteFlavor,
  watch: boolean,
): ViteConfig {
  return {
    root,
    mode: "production",
    logLevel: "warn",
    clearScreen: false,
    publicDir: false,
    base: "./",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    ...jsxOptions(flavor),
    build: {
      outDir: "dist/web",
      emptyOutDir: false,
      copyPublicDir: false,
      watch: watch ? {} : null,
      lib: {
        entry,
        formats: ["es"],
        fileName: () => "index.js",
        cssFileName: "index",
      },
      [flavor.bundlerOptionsKey]: {
        external: [...SHARED_MODULES],
        onwarn: filterWarnings,
      },
    },
  };
}
