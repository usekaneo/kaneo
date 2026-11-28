import type { ViteConfig, ViteFlavor } from "./load-vite.js";

export function jsxOptions(flavor: ViteFlavor): ViteConfig {
  if (flavor.rolldown) {
    return {
      oxc: {
        jsx: {
          runtime: "automatic",
          importSource: "react",
          development: false,
        },
      },
    };
  }
  return {
    esbuild: { jsx: "automatic", jsxImportSource: "react", jsxDev: false },
  };
}
